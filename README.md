# Courier Plus TT — GitHub Pages + Google Sheets backend

This repo contains a small frontend (for GitHub Pages) and a Google Apps Script backend that uses a Google Sheet as the database.

## What is included
- `index.html` — main shell that loads `form.html`, `orders.html`, and `tracking.html`.
- `form.html` — order submission form (uses POST to Apps Script API).
- `orders.html` — lists orders for a given email (uses GET to Apps Script API).
- `tracking.html` — package tracking page (uses GET to Apps Script API).
- `code.gs` — Google Apps Script backend (place into your Apps Script project).

## Quick setup
1. Create a GitHub repo and push these files (or upload the ZIP).
2. Deploy the Apps Script (see `code.gs`) as **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone** (or **Anyone with link**)
   - Copy the Web App URL.
3. Edit `index.html`, `form.html`, `orders.html`, and `tracking.html` and replace the placeholder `REPLACE_WITH_YOUR_APPS_SCRIPT_WEBAPP_URL` with the Web App URL.
4. Enable GitHub Pages for the repo (Settings → Pages → Source: `main` branch / root).
5. Open the GitHub Pages URL — your app should load.

## Security notes
- The Web App is set to run as _you_ (script owner). If you make it open to Anyone, anyone with the link can read and write the sheet. Consider adding a simple secret token or authentication if you want to restrict writes.
- The Apps Script uses the active spreadsheet. Make sure the spreadsheet has sheets named `Master Orders` and `Updates` with appropriate headers.

## Questions or help
If you want, I can also deploy the Apps Script for you (I cannot do it directly; I can provide exact steps).

