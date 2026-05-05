const SHEETS = {
  cards: "cards",
  comps: "comps",
};

function doGet(event) {
  const code = String(event.parameter.code || "").trim().toLowerCase();
  const callback = event.parameter.callback;
  const payload = code ? getCardPayload(code) : getIndexPayload();

  return jsonResponse(payload, callback);
}

function getIndexPayload() {
  return {
    ok: true,
    message: "SleeveScan pricing API is live. Add ?code=raw:charizard-base-4 to fetch a card.",
    codes: readRows(SHEETS.cards).map((row) => row.code),
  };
}

function getCardPayload(code) {
  const card = readRows(SHEETS.cards).find((row) => normalize(row.code) === code);

  if (!card) {
    return {
      ok: false,
      error: "Card not found",
      code,
    };
  }

  const comps = readRows(SHEETS.comps)
    .filter((row) => normalize(row.code) === code)
    .map((row) => ({
      source: row.source,
      price: row.price,
      date: row.sold_date,
      type: row.type,
      note: row.note,
      url: row.url,
    }));

  return {
    ok: true,
    card: {
      code: normalize(card.code),
      displayName: card.display_name,
      grade: card.grade,
      title: card.title,
      subtitle: card.subtitle,
      heroMeta: card.hero_meta,
      icon: card.icon,
      marketPrice: card.market_price,
      marketRange: card.market_range,
      trend: card.trend,
      trend24h: card.trend_24h,
      confidence: card.confidence,
      liquidity: card.liquidity,
      low30d: card.low_30d,
      high30d: card.high_30d,
      chartLabels: splitList(card.chart_labels),
      chartValues: splitList(card.chart_values).map(Number),
      comps,
    },
  };
}

function readRows(sheetName) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);

  if (!sheet) {
    return [];
  }

  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map((header) => normalizeHeader(header));

  return values
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row) => {
      return headers.reduce((record, header, index) => {
        record[header] = row[index];
        return record;
      }, {});
    });
}

function jsonResponse(payload, callback) {
  const body = callback
    ? `${callback}(${JSON.stringify(payload)})`
    : JSON.stringify(payload);

  const mimeType = callback
    ? ContentService.MimeType.JAVASCRIPT
    : ContentService.MimeType.JSON;

  return ContentService.createTextOutput(body).setMimeType(mimeType);
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeHeader(value) {
  return normalize(value).replace(/\s+/g, "_");
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function setupDemoSheets() {
  const spreadsheet = SpreadsheetApp.getActive();
  writeRows(spreadsheet, SHEETS.cards, [
    [
      "code",
      "display_name",
      "grade",
      "title",
      "subtitle",
      "hero_meta",
      "icon",
      "market_price",
      "market_range",
      "trend",
      "trend_24h",
      "confidence",
      "liquidity",
      "low_30d",
      "high_30d",
      "chart_labels",
      "chart_values",
    ],
    [
      "raw:charizard-base-4",
      "Charizard",
      "PSA 10",
      "1999 Pokemon Base Set #4 Charizard Holo",
      "Sleeve ID - Showcase record",
      "Base Set (1999) - #4/102 - Holo Rare",
      "FIRE",
      "$18,450",
      "Live estimate based on recent comps across eBay, Goldin, PriceCharting, Fanatics & PSA.",
      "+11.8%",
      "+3.2% 24h",
      "High",
      "Fast",
      "$16,200",
      "$21,000",
      "-05,04-10,04-15,04-20,04-25,04-30",
      "12,10,21,18,13,16,24,22,28,28,31,40,44,39,48,46,52",
    ],
  ]);

  writeRows(spreadsheet, SHEETS.comps, [
    ["code", "source", "price", "sold_date", "type", "note", "url"],
    [
      "raw:charizard-base-4",
      "eBay",
      "$18,200",
      "May 3",
      "eBay",
      "1999 Base Set Charizard PSA 10",
      "https://www.ebay.com/",
    ],
    [
      "raw:charizard-base-4",
      "Goldin",
      "$21,000",
      "Apr 30",
      "Goldin",
      "Charizard Holo PSA 10 auction",
      "https://goldin.co/",
    ],
    [
      "raw:charizard-base-4",
      "Fanatics",
      "$17,950",
      "Apr 28",
      "Fanatics",
      "Vault marketplace comp",
      "https://www.fanaticscollect.com/",
    ],
    [
      "raw:charizard-base-4",
      "PSA",
      "$18,600",
      "Recent",
      "PSA",
      "Similar certs and estimate context",
      "https://www.psacard.com/cert",
    ],
  ]);
}

function writeRows(spreadsheet, sheetName, rows) {
  const existing = spreadsheet.getSheetByName(sheetName);
  const sheet = existing || spreadsheet.insertSheet(sheetName);
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.autoResizeColumns(1, rows[0].length);
}
