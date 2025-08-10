// Apps Script backend for Courier Plus TT
// Paste this into your Google Apps Script project (bound to your spreadsheet or standalone with access to the spreadsheet).

function sendJSON(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e){
  try{
    const action = e.parameter.action;
    if(action === 'trackPackage'){
      const tn = e.parameter.trackingNumber;
      if(!tn) return sendJSON({ error: 'Missing trackingNumber' });
      return sendJSON(trackPackage(tn));
    }
    if(action === 'getOrders'){
      const email = e.parameter.email;
      if(!email) return sendJSON({ error: 'Missing email' });
      return sendJSON(getOrdersForEmail(email));
    }
    return sendJSON({ error: 'Unknown action' });
  }catch(err){
    return sendJSON({ error: err.message });
  }
}

function doPost(e){
  try{
    const payload = JSON.parse(e.postData.contents);
    if(payload.action === 'submitOrder'){
      const res = submitOrder(payload.formData || {});
      return sendJSON(res);
    }
    return sendJSON({ error: 'Unknown POST action' });
  } catch(err){
    return sendJSON({ error: err.message });
  }
}

// Append an order row, generate label PDF and optionally email the sender.
function submitOrder(formData){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Master Orders');
  if(!sheet) return { success:false, error: 'Master Orders sheet not found' };

  const headers = sheet.getDataRange().getValues()[0];
  const trackingNumber = 'CPTT-' + Utilities.getUuid().split('-')[0].toUpperCase();
  const timestamp = new Date();

  // Build row in same column order as headers (best effort)
  const row = headers.map(h => {
    switch(h){
      case 'Timestamp': return timestamp;
      case 'Tracking Number': return trackingNumber;
      case 'Email': case 'Email Address': return formData.email || '';
      case 'Sender Name': case 'Sender': return formData.sender || '';
      case 'Receiver Name': case 'Receiver': return formData.receiver || '';
      case 'Receiver Contact': case 'Contact': return formData.contact || '';
      case 'Receiver Home Address': case 'Home Address': return formData.homeAddress || '';
      case 'Receiver Work Address': case 'Work Address': return formData.workAddress || '';
      case 'Receiver City/Town': case 'City': return formData.city || '';
      case 'C.O.D (Cash on Delivery) Delivery fee included': case 'C.O.D': return formData.cod || '';
      case 'Instructions': case 'Special Instructions': return formData.instructions || '';
      case 'Shipment Type': return formData.shipmentType || '';
      case 'Contents': case 'Content Description': return formData.contents || '';
      case 'Latest Status': return formData.shipmentType || 'Created';
      case 'Status Update Timestamp': return timestamp;
      case 'Comments': return '';
      case 'Email Sent': return 'No';
      default: return '';
    }
  });

  sheet.appendRow(row);

  // Create label PDF (best effort)
  try{
    const barcodeUrl = 'https://bwipjs-api.metafloor.com/?bcid=code128&text=' + encodeURIComponent(trackingNumber) + '&scale=3&includetext';
    const barcodeBlob = UrlFetchApp.fetch(barcodeUrl).getBlob().setName('barcode.png');
    const doc = DocumentApp.create('Label - ' + trackingNumber);
    const body = doc.getBody();
    body.setMarginTop(20).setMarginBottom(20).setMarginLeft(20).setMarginRight(20);
    try{
      const logoBlob = DriveApp.getFileById('1xea5uY2P2axAgtfiExw3YDf722H_DiZw').getBlob();
      const logoImage = body.appendImage(logoBlob).setWidth(80).setHeight(40);
      logoImage.getParent().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    }catch(e){ Logger.log('Logo not found: ' + e.message); }
    body.appendParagraph('PACKAGE LABEL').setHeading(DocumentApp.ParagraphHeading.HEADING3).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    body.appendParagraph('Tracking #: ' + trackingNumber).setBold(true).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    const barcodeImage = body.appendImage(barcodeBlob).setWidth(190).setHeight(90);
    barcodeImage.getParent().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    const lines = [
      'Sender: ' + (formData.sender||''),
      'Receiver: ' + (formData.receiver||''),
      'Contact: ' + (formData.contact||''),
      'Home Address: ' + (formData.homeAddress||''),
      'Work Address: ' + (formData.workAddress||''),
      'City/Town: ' + (formData.city||''),
      'C.O.D: ' + (formData.cod||''),
      'Instructions: ' + (formData.instructions||''),
      'Shipment Type: ' + (formData.shipmentType||'')
    ];
    lines.forEach(line => body.appendParagraph(line).setSpacingAfter(4));
    doc.saveAndClose();
    const pdf = DriveApp.getFileById(doc.getId()).getAs(MimeType.PDF);
    const folderId = '1UxUU7p6RtxkS5rmOPGfKdEKJKq51N-qM'; // ensure this folder exists or change
    try { DriveApp.getFolderById(folderId).createFile(pdf); } catch(e) { Logger.log('Could not save PDF to folder: ' + e.message); }
    if(formData.email){
      try{
        MailApp.sendEmail({ to: formData.email, subject: 'Your Package Label – ' + trackingNumber, htmlBody: 'Hello ' + (formData.sender||'') + ',<br><br>Your package label for tracking number <b>' + trackingNumber + '</b> is attached.<br><br>Thanks,<br>Courier Plus TT', attachments:[pdf] });
      }catch(e){ Logger.log('Email send failed: ' + e.message); }
    }
  }catch(e){
    Logger.log('Label creation error: ' + e.message);
  }

  return { success:true, trackingNumber: trackingNumber };
}

// Return orders matching an email address (case-insensitive)
function getOrdersForEmail(email){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Master Orders');
  if(!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  // find email column (try several common header names)
  const emailCol = headers.findIndex(h => /email/i.test(h)) || 0;
  const rows = data.slice(1).filter(r => (r[emailCol] || '').toString().toLowerCase() === email.toLowerCase());
  return rows.map(r => {
    const obj = {};
    headers.forEach((h,i) => obj[h] = r[i]);
    // add Latest Status and Status Update Timestamp if missing
    if(!obj['Latest Status']) obj['Latest Status'] = obj['Shipment Type'] || 'Unknown';
    return obj;
  });
}

// Track package (unchanged logic)
function trackPackage(trackingNumber){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Master Orders');
  if(!sheet) throw new Error('Master Orders sheet not found.');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const tnIndex = headers.indexOf('Tracking Number');
  if(tnIndex === -1) throw new Error('Tracking Number column not found.');
  const match = data.find(row => row[tnIndex] === trackingNumber);
  if(!match) return { package: null };
  const packageInfo = {}; headers.forEach((h,i)=> packageInfo[h] = match[i]);
  const updatesSheet = ss.getSheetByName('Updates');
  if(!updatesSheet) throw new Error('Updates sheet not found.');
  const updatesData = updatesSheet.getDataRange().getValues();
  const updateHeaders = updatesData[0];
  const uTNIndex = updateHeaders.indexOf('Tracking Number');
  const tsIndex = updateHeaders.indexOf('Timestamp');
  const statusIndex = updateHeaders.indexOf('Status');
  const detailsIndex = updateHeaders.indexOf('Details');
  const history = updatesData.slice(1).filter(r=> r[uTNIndex] === trackingNumber).map(r=>({ timestamp: r[tsIndex], status: r[statusIndex], details: r[detailsIndex] })).sort((a,b)=> new Date(b.timestamp)-new Date(a.timestamp));
  const latestUpdate = history.length ? history[0] : null;
  packageInfo['Latest Status'] = latestUpdate ? latestUpdate.status : packageInfo['Shipment Type'] || 'Unknown';
  packageInfo['Status Update Timestamp'] = latestUpdate ? latestUpdate.timestamp : '';
  return { package: packageInfo, history: history };
}
