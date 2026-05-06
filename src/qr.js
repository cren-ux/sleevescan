import { saveCreatedCard } from "./createdCards.js";
import { buildQrImageUrl, printQrCode, saveQrCode } from "./qrStore.js";

const searchInput = document.querySelector("#card-search-input");
const searchButton = document.querySelector("#card-search-button");
const statusText = document.querySelector("#qr-status");
const catalogResults = document.querySelector("#catalog-results");
const catalogResultsShell = document.querySelector("#catalog-results-shell");
const closeResultsButton = document.querySelector("#close-results-button");
const selectedCardPanel = document.querySelector("#selected-card-panel");
const selectedCardImage = document.querySelector("#selected-card-image");
const selectedCardName = document.querySelector("#selected-card-name");
const selectedCardMeta = document.querySelector("#selected-card-meta");
const variantSelect = document.querySelector("#variant-select");
const conditionSelect = document.querySelector("#condition-select");
const languageSelect = document.querySelector("#language-select");
const generateQrButton = document.querySelector("#generate-qr-button");
const qrOutputPanel = document.querySelector("#qr-output-panel");
const printQrButton = document.querySelector("#print-qr-button");
const qrPreview = document.querySelector("#qr-preview");
const qrImage = document.querySelector("#qr-image");
const qrPreviewLabel = document.querySelector("#qr-preview-label");
const qrPayload = document.querySelector("#qr-payload");
const qrDownloadLink = document.querySelector("#qr-download-link");
const cardScanButton = document.querySelector("#card-scan-button");
const cardScanVideo = document.querySelector("#card-scan-video");

let selectedCard = null;
let activeRecord = null;
let scanStream = null;
let scanSearchTimer = null;
let ocrPromise = null;
let isRecognizingCard = false;
let lastDetectedType = "";

const OCR_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
const OCR_STOPWORDS = new Set([
  "basic",
  "stage",
  "evolves",
  "from",
  "hp",
  "weakness",
  "resistance",
  "retreat",
  "pokemon",
  "trainer",
  "energy",
]);

const TYPE_LABELS = {
  Grass: "green/Grass",
  Fire: "red/Fire",
  Water: "blue/Water",
  Lightning: "yellow/Lightning",
  Psychic: "purple/Psychic",
  Fighting: "brown/Fighting",
  Darkness: "dark/Darkness",
  Metal: "gray/Metal",
};

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function extractSleeveCode(value) {
  const rawValue = value.trim();

  try {
    const url = new URL(rawValue);
    return url.searchParams.get("card")?.trim().toLowerCase() ?? rawValue.toLowerCase();
  } catch (error) {
    return rawValue.toLowerCase();
  }
}

function getPrimaryName(query) {
  return query.trim().split(/\s+/)[0] ?? "";
}

function getTypeLabel(type) {
  return TYPE_LABELS[type] ?? type;
}

function getLikelyCardName(text) {
  const lines = text
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/[^a-zA-Z' -]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);

  return (
    lines.find((line) => {
      const lower = line.toLowerCase();
      const firstWord = lower.split(/\s+/)[0];
      return (
        line.length >= 4 &&
        line.length <= 34 &&
        !OCR_STOPWORDS.has(firstWord) &&
        !lower.includes("evolves from")
      );
    }) ?? ""
  );
}

function buildPricingQuery(card, variant, condition, language) {
  const rawGrade = condition.startsWith("Raw") ? "" : condition;
  const terms = [card.name, card.set.name, card.number, variant, rawGrade, language]
    .filter(Boolean)
    .join(" ");
  return terms.replace(/\s+/g, " ").trim();
}

function buildInternalCode(card, variant, condition, language) {
  return [
    "card",
    slugify(card.name),
    slugify(card.set.name),
    slugify(card.number),
    slugify(variant),
    slugify(condition),
    slugify(language),
  ].join(":");
}

function buildDetailsUrl(cardRecord) {
  const detailsUrl = new URL("./details.html", window.location.href);
  detailsUrl.searchParams.set("card", cardRecord.code);
  detailsUrl.searchParams.set("name", cardRecord.displayName);
  detailsUrl.searchParams.set("grade", cardRecord.grade);
  detailsUrl.searchParams.set("meta", cardRecord.heroMeta);
  detailsUrl.searchParams.set("price", cardRecord.marketPrice);
  detailsUrl.searchParams.set("range", cardRecord.marketRange);
  return detailsUrl.toString();
}

function getDisplayPrice(card) {
  const prices = card.tcgplayer?.prices ?? {};
  const priceGroups = Object.values(prices);
  const marketPrice = priceGroups.find((group) => group.market)?.market;

  if (!marketPrice) {
    return "Market pending";
  }

  return `$${Number(marketPrice).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getSearchQuery() {
  return searchInput.value.trim();
}

function hideResultsSheet() {
  catalogResultsShell.hidden = true;
  catalogResultsShell.classList.remove("catalog-results-shell--popup");
}

function resetGeneratedQr() {
  activeRecord = null;
  qrOutputPanel.hidden = true;
  qrPreview.hidden = true;
  printQrButton.hidden = true;
}

function clearCardSelection() {
  selectedCard = null;
  selectedCardPanel.hidden = true;
  resetGeneratedQr();
}

function loadOcr() {
  if (window.Tesseract) {
    return Promise.resolve(window.Tesseract);
  }

  if (ocrPromise) {
    return ocrPromise;
  }

  ocrPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = OCR_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.Tesseract) {
        resolve(window.Tesseract);
      } else {
        reject(new Error("OCR library did not load."));
      }
    };
    script.onerror = () => {
      ocrPromise = null;
      reject(new Error("OCR library failed to load."));
    };
    document.head.appendChild(script);
  });

  return ocrPromise;
}

function captureCardFrame() {
  const width = cardScanVideo.videoWidth;
  const height = cardScanVideo.videoHeight;

  if (!width || !height) {
    return "";
  }

  const fullCanvas = document.createElement("canvas");
  const targetWidth = 900;
  const scale = Math.min(targetWidth / width, 1);
  fullCanvas.width = Math.round(width * scale);
  fullCanvas.height = Math.round(height * scale);

  const context = fullCanvas.getContext("2d", { willReadFrequently: true });
  context.filter = "contrast(1.35) saturate(0.85)";
  context.drawImage(cardScanVideo, 0, 0, fullCanvas.width, fullCanvas.height);

  const detectedType = detectCardTypeFromCanvas(fullCanvas);
  const nameBandHeight = Math.round(fullCanvas.height * 0.28);
  const nameCanvas = document.createElement("canvas");
  nameCanvas.width = fullCanvas.width;
  nameCanvas.height = nameBandHeight;
  const nameContext = nameCanvas.getContext("2d");
  nameContext.filter = "grayscale(1) contrast(1.8)";
  nameContext.drawImage(
    fullCanvas,
    0,
    0,
    fullCanvas.width,
    nameBandHeight,
    0,
    0,
    fullCanvas.width,
    nameBandHeight
  );

  return {
    detectedType,
    image: nameCanvas.toDataURL("image/png"),
  };
}

function detectCardTypeFromCanvas(canvas) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const sampleWidth = Math.max(Math.round(canvas.width * 0.76), 1);
  const sampleHeight = Math.max(Math.round(canvas.height * 0.76), 1);
  const sampleLeft = Math.round((canvas.width - sampleWidth) / 2);
  const sampleTop = Math.round((canvas.height - sampleHeight) / 2);
  const imageData = context.getImageData(sampleLeft, sampleTop, sampleWidth, sampleHeight).data;
  const counts = {
    Darkness: 0,
    Fighting: 0,
    Fire: 0,
    Grass: 0,
    Lightning: 0,
    Metal: 0,
    Psychic: 0,
    Water: 0,
  };

  for (let index = 0; index < imageData.length; index += 64) {
    const red = imageData[index];
    const green = imageData[index + 1];
    const blue = imageData[index + 2];
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const chroma = max - min;

    if (max < 42) {
      counts.Darkness += 1;
      continue;
    }

    if (chroma < 22) {
      counts.Metal += 1;
      continue;
    }

    const hue = getHue(red, green, blue, max, chroma);

    if (hue >= 70 && hue <= 165) counts.Grass += 1;
    if (hue > 165 && hue <= 250) counts.Water += 1;
    if (hue > 250 && hue <= 320) counts.Psychic += 1;
    if (hue > 320 || hue <= 25) counts.Fire += 1;
    if (hue > 25 && hue < 48) counts.Fighting += 1;
    if (hue >= 48 && hue < 70) counts.Lightning += 1;
  }

  const [type, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return count > 6 ? type : "";
}

function getHue(red, green, blue, max, chroma) {
  let hue = 0;

  if (max === red) {
    hue = ((green - blue) / chroma) % 6;
  } else if (max === green) {
    hue = (blue - red) / chroma + 2;
  } else {
    hue = (red - green) / chroma + 4;
  }

  return Math.round(hue * 60 + (hue < 0 ? 360 : 0));
}

async function searchCards({ fromScan = false, detectedType = lastDetectedType } = {}) {
  const query = getSearchQuery();
  const primaryName = getPrimaryName(query);

  if (!primaryName) {
    catalogResults.innerHTML = "";
    hideResultsSheet();
    clearCardSelection();
    statusText.textContent =
      fromScan
        ? "Scan the card again with the name area larger in frame."
        : "Type a card name to search.";
    return;
  }

  catalogResults.innerHTML = "";
  catalogResultsShell.hidden = false;
  catalogResultsShell.classList.toggle("catalog-results-shell--popup", fromScan);
  clearCardSelection();
  statusText.textContent = fromScan
    ? `Scanning catalog matches${detectedType ? ` for ${getTypeLabel(detectedType)} cards` : ""}...`
    : "Searching Pokemon TCG catalog...";

  try {
    const cards = await fetchCatalogCards(primaryName, detectedType);
    renderResults(cards, query, fromScan, detectedType);
  } catch (error) {
    statusText.textContent = "Catalog search failed. Check your internet connection and try again.";
  }
}

async function fetchCatalogCards(primaryName, detectedType) {
  const queryWithType = detectedType
    ? `name:${primaryName}* types:${detectedType}`
    : `name:${primaryName}*`;
  const cards = await fetchCatalogQuery(queryWithType);

  if (cards.length || !detectedType) {
    return cards;
  }

  return fetchCatalogQuery(`types:${detectedType}`);
}

async function fetchCatalogQuery(query) {
  const url = new URL("https://api.pokemontcg.io/v2/cards");
  url.searchParams.set("q", query);
  url.searchParams.set("orderBy", "set.releaseDate,name,number");
  url.searchParams.set("pageSize", "16");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Pokemon TCG API returned ${response.status}`);
  }

  const payload = await response.json();
  return payload.data ?? [];
}

async function recognizeCardFromCamera() {
  if (isRecognizingCard) {
    return;
  }

  isRecognizingCard = true;
  statusText.textContent = "Reading the card name from the camera...";

  try {
    const scanFrame = captureCardFrame();

    if (!scanFrame.image) {
      throw new Error("No camera frame available.");
    }

    lastDetectedType = scanFrame.detectedType;
    const Tesseract = await loadOcr();
    const result = await Tesseract.recognize(scanFrame.image, "eng");
    const recognizedName = getLikelyCardName(result.data?.text ?? "");

    if (!scanStream) {
      return;
    }

    if (!recognizedName) {
      statusText.textContent =
        "I could not read the card name. Move closer, reduce glare, and scan again.";
      scheduleLiveScanSearch();
      return;
    }

    searchInput.value = recognizedName;
    statusText.textContent = `Detected "${recognizedName}"${
      lastDetectedType ? ` on a ${getTypeLabel(lastDetectedType)} card` : ""
    }. Pulling matching cards...`;
    await searchCards({ fromScan: true, detectedType: lastDetectedType });
  } catch (error) {
    statusText.textContent =
      "Automatic recognition failed. Try better lighting or use manual search.";
    if (!String(error.message).includes("OCR library")) {
      scheduleLiveScanSearch();
    }
  } finally {
    isRecognizingCard = false;
  }
}

function renderResults(cards, query, fromScan, detectedType = "") {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scoredCards = cards
    .map((card) => {
      const typeMatch = detectedType && card.types?.includes(detectedType);
      const haystack = `${card.name} ${card.set.name} ${card.number} ${card.rarity ?? ""} ${
        card.types?.join(" ") ?? ""
      }`.toLowerCase();
      const textScore = queryTerms.filter((term) => haystack.includes(term)).length;
      const score = textScore + (typeMatch ? 4 : 0);
      return { card, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.card);

  statusText.textContent = scoredCards.length
    ? fromScan
      ? `Live matches found${detectedType ? `, filtered toward ${getTypeLabel(detectedType)}` : ""}. Pick the exact card.`
      : "Pick the exact card from the catalog."
    : "No catalog matches found. Try fewer words.";

  scoredCards.forEach((card) => {
    const button = document.createElement("button");
    const image = document.createElement("img");
    const content = document.createElement("span");
    const name = document.createElement("strong");
    const meta = document.createElement("small");
    const price = document.createElement("small");

    button.className = "catalog-card";
    button.type = "button";
    image.src = card.images?.small ?? "";
    image.alt = card.name;
    name.textContent = card.name;
    meta.textContent = `${card.set.name} · ${card.number} · ${
      card.types?.join("/") ?? "Unknown type"
    } · ${card.rarity ?? "Unknown rarity"}`;
    price.textContent = getDisplayPrice(card);
    content.append(name, meta, price);
    button.append(image, content);
    button.addEventListener("click", () => selectCard(card));
    catalogResults.appendChild(button);
  });
}

function selectCard(card) {
  selectedCard = card;
  stopCardScan();
  hideResultsSheet();
  selectedCardImage.src = card.images?.small ?? "";
  selectedCardName.textContent = card.name;
  selectedCardMeta.textContent = `${card.set.name} · ${card.number} · ${card.rarity ?? "Unknown rarity"}`;
  selectedCardPanel.hidden = false;
  resetGeneratedQr();
  statusText.textContent = "Card selected. Confirm the variant and condition, then generate the QR code.";
  selectedCardPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function stopCardScan() {
  if (scanSearchTimer) {
    window.clearTimeout(scanSearchTimer);
    scanSearchTimer = null;
  }

  if (scanStream) {
    scanStream.getTracks().forEach((track) => track.stop());
    scanStream = null;
  }

  cardScanVideo.srcObject = null;
  cardScanVideo.classList.remove("is-live");
  cardScanButton.textContent = "Scan card";
}

function scheduleLiveScanSearch() {
  if (!scanStream) {
    return;
  }

  if (scanSearchTimer) {
    window.clearTimeout(scanSearchTimer);
  }

  scanSearchTimer = window.setTimeout(() => {
    recognizeCardFromCamera();
  }, 900);
}

async function startCardScan() {
  if (scanStream) {
    stopCardScan();
    statusText.textContent = "Card scan stopped.";
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    statusText.textContent = "Camera is unavailable in this browser. Use search instead.";
    return;
  }

  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    cardScanVideo.srcObject = scanStream;
    cardScanVideo.classList.add("is-live");
    await cardScanVideo.play();
    cardScanButton.textContent = "Stop scan";
    statusText.textContent = "Hold the card steady. I will read the card name and pull matches.";
    scheduleLiveScanSearch();
  } catch (error) {
    stopCardScan();
    statusText.textContent = "Camera access was blocked. Use search instead.";
  }
}

function saveSelectedCardRecord() {
  const variant = variantSelect.value;
  const condition = conditionSelect.value;
  const language = languageSelect.value;
  const code = buildInternalCode(selectedCard, variant, condition, language);
  const pricingQuery = buildPricingQuery(selectedCard, variant, condition, language);
  const title = `${selectedCard.name} ${variant}`;

  const cardRecord = {
    code,
    displayName: selectedCard.name,
    grade: condition,
    title,
    subtitle: `${selectedCard.set.name} · ${selectedCard.number} · ${language}`,
    heroMeta: `${selectedCard.set.name} · ${selectedCard.number} · ${variant}`,
    icon: "CARD",
    marketPrice: getDisplayPrice(selectedCard),
    marketRange: `Pricing query: ${pricingQuery}`,
    trend: "Live",
    trend24h: "Pending comps",
    confidence: "Review",
    liquidity: "Unknown",
    low30d: "--",
    high30d: "--",
    chartLabels: ["Now"],
    chartValues: [1],
    comps: [],
    catalogId: selectedCard.id,
    setName: selectedCard.set.name,
    cardNumber: selectedCard.number,
    variant,
    condition,
    language,
    pricingQuery,
    excludeTerms: condition.startsWith("Raw")
      ? "PSA BGS CGC Japanese damaged world championship"
      : "raw damaged world championship",
  };

  return {
    cardRecord: saveCreatedCard(cardRecord),
    variant,
    condition,
    language,
  };
}

function renderQrRecord(record, label) {
  const qrUrl = buildQrImageUrl(record.payload);

  activeRecord = record;
  qrImage.src = qrUrl;
  qrPreviewLabel.textContent = label;
  qrPayload.textContent = record.payload;
  qrDownloadLink.href = qrUrl;
  qrOutputPanel.hidden = false;
  qrPreview.hidden = false;
  printQrButton.hidden = false;
}

function generateQrCode() {
  if (!selectedCard) {
    statusText.textContent = "Choose a catalog card first.";
    return;
  }

  const { cardRecord, variant, condition } = saveSelectedCardRecord();
  const record = saveQrCode({
    code: cardRecord.code,
    mode: "link",
    payload: buildDetailsUrl(cardRecord),
  });

  renderQrRecord(record, `${selectedCard.name} · ${variant} · ${condition}`);
  statusText.textContent = "QR code generated as a direct card link and card info stored in the local demo database.";
}

function applyUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (!code) {
    return;
  }

  const normalized = extractSleeveCode(code);
  const record = saveQrCode({
    code: normalized,
    mode: "link",
    payload: buildDetailsUrl({
      code: normalized,
      displayName: normalized,
      grade: "Saved QR",
      heroMeta: "Saved sleeve code",
      marketPrice: "--",
      marketRange: "Open this QR from a generated card record for full details.",
    }),
  });
  renderQrRecord(record, normalized);
  statusText.textContent = "Saved QR loaded. You can print it again or search for another card.";
}

searchButton.addEventListener("click", () => {
  lastDetectedType = "";
  searchCards();
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    lastDetectedType = "";
    searchCards();
  }
});

searchInput.addEventListener("input", () => {
  catalogResults.innerHTML = "";
  hideResultsSheet();
  clearCardSelection();
  lastDetectedType = "";
  statusText.textContent = "Search updated. Tap Search or Scan card for fresh matches.";
  scheduleLiveScanSearch();
});

cardScanButton.addEventListener("click", startCardScan);

generateQrButton.addEventListener("click", generateQrCode);

printQrButton.addEventListener("click", () => {
  if (activeRecord) {
    printQrCode(activeRecord);
  }
});

closeResultsButton.addEventListener("click", () => {
  hideResultsSheet();
});

window.addEventListener("beforeunload", () => {
  stopCardScan();
});

applyUrlParams();
