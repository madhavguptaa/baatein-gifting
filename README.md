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

## Verify eligible phone numbers and save claims

The user must first enter a phone number. The web app checks it against a
private `Eligible` tab in the same Google spreadsheet before showing the
delivery form. Add eligible 10-digit phone numbers in column A of that tab.
The `Claims` tab stores completed claims; the script also prevents a number
from claiming twice. You can export the spreadsheet as Excel from
**File → Download → Microsoft Excel (.xlsx)**.

1. Create a Google Sheet with two tabs named `Eligible` and `Claims`.
   Put eligible phone numbers in column A of `Eligible` (10 digits; a header
   row is okay).
2. In the sheet, open **Extensions → Apps Script** and paste this script.
   Replace `YOUR_SHEET_ID` with the ID between `/d/` and `/edit` in the sheet URL.
3. Choose **Deploy → New deployment → Web app**. Set **Execute as** to yourself
   and access to **Anyone**, authorize it, then copy the web app URL ending in
   `/exec`.
4. Put the URL in a `.env` file at the project root:

   ```sh
   VITE_GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
   ```

5. Restart `npm run dev`. First test a number in `Eligible`, then test a number
   that is not listed. Only eligible numbers should reach the delivery form.

```javascript
const SHEET_ID = "YOUR_SHEET_ID";
const ELIGIBLE_SHEET_NAME = "Eligible";
const SHEET_NAME = "Claims";

function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return digits;
}

function getPhoneStatus(phone) {
  if (!/^\d{10}$/.test(phone)) {
    return { eligible: false, status: "not_eligible" };
  }

  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const eligibleSheet = spreadsheet.getSheetByName(ELIGIBLE_SHEET_NAME);
  const claimsSheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!eligibleSheet) throw new Error('Create a sheet tab named "Eligible".');
  if (!claimsSheet) throw new Error('Create a sheet tab named "Claims".');

  const eligibleNumbers = eligibleSheet
    .getRange(1, 1, Math.max(eligibleSheet.getLastRow(), 1), 1)
    .getDisplayValues()
    .flat()
    .map(normalizePhone);
  if (!eligibleNumbers.includes(phone)) {
    return { eligible: false, status: "not_eligible" };
  }

  const lastClaimRow = claimsSheet.getLastRow();
  const claimedNumbers = lastClaimRow
    ? claimsSheet.getRange(1, 3, lastClaimRow, 1).getDisplayValues().flat()
        .map(normalizePhone)
    : [];
  if (claimedNumbers.includes(phone)) {
    return { eligible: false, status: "already_claimed" };
  }

  return { eligible: true, status: "eligible" };
}

function jsonp(callback, value) {
  if (!/^[A-Za-z_$][\w$]*$/.test(callback || "")) {
    return ContentService.createTextOutput("Invalid callback");
  }

  return ContentService
    .createTextOutput(`${callback}(${JSON.stringify(value)});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function doGet(e) {
  try {
    if (!e || !e.parameter || e.parameter.action !== "check") {
      throw new Error("Unknown action");
    }

    const phone = normalizePhone(e.parameter.phone);
    return jsonp(e.parameter.callback, getPhoneStatus(phone));
  } catch (error) {
    console.error(error);
    return jsonp(e && e.parameter && e.parameter.callback, {
      eligible: false,
      status: "error",
    });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const payload = e && e.parameter && e.parameter.payload;
    if (!payload) throw new Error("Missing payload");

    const data = JSON.parse(payload);
    const phone = normalizePhone(data.phone);
    if (!/^\d{10}$/.test(phone)) {
      throw new Error("A valid 10-digit mobile number is required");
    }

    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Create a sheet tab named "Claims".');

    const eligibleNumbers = spreadsheet.getSheetByName(ELIGIBLE_SHEET_NAME);
    if (!eligibleNumbers) throw new Error('Create a sheet tab named "Eligible".');
    const allowed = eligibleNumbers
      .getRange(1, 1, Math.max(eligibleNumbers.getLastRow(), 1), 1)
      .getDisplayValues()
      .flat()
      .map(normalizePhone)
      .includes(phone);
    if (!allowed) {
      return ContentService.createTextOutput("not_eligible");
    }

    const lastRow = sheet.getLastRow();
    const claimedPhones = lastRow
      ? sheet.getRange(1, 3, lastRow, 1).getDisplayValues().flat()
      : [];
    const alreadyClaimed = claimedPhones.some(
      (value) => normalizePhone(value) === phone,
    );

    if (alreadyClaimed) {
      return ContentService.createTextOutput("duplicate");
    }

    const location = data.location || {};
    sheet.appendRow([
      data.submittedAt || new Date().toISOString(),
      data.name || "",
      phone,
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
  } finally {
    lock.releaseLock();
  }
}
```

The columns will be added in this order: timestamp, name, phone, house/flat,
street/area, landmark, PIN code, city, state, country, latitude, longitude.
The browser checks eligibility using a JSONP GET request because Apps Script
does not provide a normal CORS response. The POST handler independently checks
eligibility and duplicate claims before writing, so bypassing the UI cannot add
an unlisted number to `Claims`. The script URL is public and the eligibility
endpoint reveals whether a guessed phone number is on the list; this is not
proof that the user owns that phone number. Use SMS OTP verification if you
need to verify phone ownership. Save and deploy a new web app version after
updating the script. Check **Apps Script → Executions** and the `Claims` tab
when testing.

Without a webhook configured, the page is in demo mode and does not store or
send claims.
