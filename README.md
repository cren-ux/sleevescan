# CardCompanion Prototype

Mobile-first prototype for a Pokemon card pricing app that scans a QR code on a
card sleeve and returns an estimated fair market value from recent comps.

## What is included

- Responsive UI designed like a mobile pricing app
- Camera scan prototype using `getUserMedia`
- QR detection path via `BarcodeDetector` when supported by the browser
- Inventory lookup using sleeve IDs such as `psa:117401741`
- Simulated comp blending across eBay, PriceCharting, PSA, Goldin, and Fanatics

## Run

Start any static server from the repo root, then open `index.html`.

Example:

```bash
python3 -m http.server 4173
```

Then navigate to [http://localhost:4173](http://localhost:4173).

For a one-command local preview on Mac, run:

```bash
./preview.command
```

Or use the shell version:

```bash
./preview.sh
```

Both default to port `4173`. You can pass a different port if needed, for
example `./preview.sh 5000`.

## Sample sleeve codes

- `psa:117401741`
- `psa:134400879`
- `raw:charizard-base-4`

## QR code generator

The home page menu includes a `Create Qr Code` button that opens `qr.html`.

- `App scan` creates a QR whose text is only the sleeve code, such as
  `psa:117401741`. Use this for QR stickers scanned inside SleeveScan.
- `Direct link` creates a QR that opens the details page directly in a normal
  phone camera app. Use this for investor demos when you want the phone camera
  to launch the card page immediately.

The generated QR image uses the free `api.qrserver.com` image endpoint, so it
needs internet access while generating the QR. The encoded card code still maps
to your Google Sheet row or local fallback data.

Generated QR codes are saved in the browser with `localStorage`. Open
`qr-list.html` to view saved codes alphabetically, edit them, or print them
again. Saved codes live on the device/browser that created them.

## Free Google Sheets backend

This project can use a free Google Sheet as a temporary pricing database for
investor demos. The app checks the sheet first when `GOOGLE_SHEETS_API_URL` is
set in `src/appConfig.js`; if the sheet is not configured or a request fails,
the app falls back to the local demo data in `src/cardData.js`.

### Step-by-step setup

1. Create a new Google Sheet named `SleeveScan Pricing Demo`.
2. Add two tabs named exactly `cards` and `comps`.
3. Copy the rows from `data/cards-template.csv` into the `cards` tab.
4. Copy the rows from `data/comps-template.csv` into the `comps` tab.
5. In Google Sheets, go to `Extensions` > `Apps Script`.
6. Replace the default script with the contents of `apps-script/Code.gs`.
7. Click `Deploy` > `New deployment`.
8. Choose `Web app`.
9. Set `Execute as` to `Me`.
10. Set `Who has access` to `Anyone`.
11. Click `Deploy` and copy the Web app URL that ends in `/exec`.
12. Open `src/appConfig.js` and paste that URL between the quotes:

```js
export const GOOGLE_SHEETS_API_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";
```

13. Restart the preview server and open the app.
14. Test the endpoint in a browser with:

```text
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?code=raw:charizard-base-4
```

If JSON appears, the app can read your sheet.

### Adding real free test data

For each card, add one row to `cards` and multiple rows to `comps`. The QR code
text should match the `code` column exactly. For example, a QR containing
`psa:117401741` loads the row whose `code` is `psa:117401741`.

Free sources to populate manually for now:

- PSA public cert pages for cert identity, estimates, and similar sales.
- eBay developer account with Browse API for live listing context.
- Fanatics Collect public sales history when visible.
- Goldin public sold auction pages.
- PriceCharting public page values entered manually, since the official API is
  paid.

## Product direction

Best initial launch path:

1. Use QR codes that resolve to your own inventory IDs.
2. Focus on graded cards first, especially PSA.
3. Price from eBay solds + PriceCharting + PSA identity data.
4. Add Goldin and Fanatics as premium or supplemental signals once access is solved.

## Current source reality

These were checked on May 4, 2026:

- eBay Browse API is official and supports item discovery, while eBay Marketplace
  Insights exposes sold history but is a limited-release API:
  [Browse API](https://developer.ebay.com/api-docs/buy/api-browse.html),
  [Marketplace Insights overview](https://www.edp.ebay.com/api-docs/buy/marketplace-insights/static/overview.html)
- PriceCharting has an official paid API for current item values:
  [PriceCharting API docs](https://www.pricecharting.com/api-documentation)
- PSA cert pages expose certification identity, population, and in many cases
  estimate and similar sales context:
  [PSA cert verification](https://www.psacard.com/cert)
- Goldin and Fanatics Collect clearly publish sale pages and marketplace flows,
  but this prototype does not assume a public first-party pricing API for them.
  If you want true live coverage there, plan on a partnership, licensed feed, or
  compliant ingestion pipeline.

## Manual verification

- Open the page on desktop and confirm the layout stays readable.
- Open it on mobile and confirm the phone-style results card feels native.
- Click each sample sleeve code and confirm the pricing card updates.
- Paste a supported code and press Enter.
- Test `Start Camera Scan` on a phone browser and confirm the camera opens.
- If the browser supports `BarcodeDetector`, scan a QR code containing one of the
  sample sleeve IDs and confirm it resolves.
