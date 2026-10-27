# Baatein gift claim

## Run locally

```sh
npm install
npm run dev
```

## Fill an address from location

The location button asks the user for permission, then uses OpenStreetMap
reverse geocoding to fill any available house number, street/area, PIN code,
city, and state. Map data may not include a house number, so users can check
and edit every field before submitting. The browser must have location access,
and the site must use HTTPS (localhost also works).

## Send claims to a spreadsheet

This setup writes to Google Sheets. You can export the sheet to Excel from
**File → Download → Microsoft Excel (.xlsx)**. To write directly to Excel
Online instead, connect a server-side endpoint using Microsoft Power Automate;
do not put Microsoft credentials in this React app.

1. Create a Google Sheet and add a tab named `Claims`.
2. In the sheet, open **Extensions → Apps Script** and paste this script.
   Replace `YOUR_SHEET_ID` with the ID between `/d/` and `/edit` in the sheet URL.
3. Choose **Deploy → New deployment → Web app**. Set **Execute as** to yourself
   and access to **Anyone**, authorize it, then copy the web app URL ending in
   `/exec`.
4. Put the URL in a `.env` file at the project root:

   ```sh
   VITE_GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
   ```

5. Restart `npm run dev`, submit a test claim, and check the `Claims` tab.

```javascript
const SHEET_ID = "YOUR_SHEET_ID";

function doPost(e) {
  const data = JSON.parse(e.parameter.payload || "{}");
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Claims");
  if (!sheet) throw new Error('Create a sheet tab named "Claims".');

  const location = data.location || {};
  sheet.appendRow([
    data.submittedAt || new Date().toISOString(),
    data.name || "",
    data.phone || "",
    data.house || "",
    data.area || "",
    data.landmark || "",
    data.pincode || "",
    data.city || "",
    data.state || "",
    data.country || "India",
    location.latitude ?? "",
    location.longitude ?? "",
  ]);

  return ContentService.createTextOutput("ok");
}
```

The columns will be added in this order: timestamp, name, phone, house/flat,
street/area, landmark, PIN code, city, state, country, latitude, longitude.
The browser sends the form as a simple cross-origin request because Apps Script
does not provide a normal CORS response. It cannot confirm whether Apps Script
successfully wrote the row, so check **Apps Script → Executions** if a test is
missing. Keep access to the sheet restricted; the public web app URL can be
used by anyone who has it. Do not put sheet credentials or private keys in the
frontend.

Without a webhook configured, the page is in demo mode and does not store or
send claims.
