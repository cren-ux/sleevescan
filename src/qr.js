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
  const query = searchInput.value.trim();
  return query || "umbreon";
}

async function searchCards({ fromScan = false } = {}) {
  const query = getSearchQuery();
  const primaryName = getPrimaryName(query);

  if (!primaryName) {
    statusText.textContent = "Type a card name to search.";
    return;
  }

  catalogResults.innerHTML = "";
  catalogResultsShell.hidden = false;
  catalogResultsShell.classList.toggle("catalog-results-shell--popup", fromScan);
  selectedCardPanel.hidden = true;
  qrOutputPanel.hidden = true;
  qrPreview.hidden = true;
  printQrButton.hidden = true;
  statusText.textContent = fromScan
    ? "Scanning catalog matches..."
    : "Searching Pokemon TCG catalog...";

  try {
    const url = new URL("https://api.pokemontcg.io/v2/cards");
    url.searchParams.set("q", `name:${primaryName}*`);
    url.searchParams.set("orderBy", "set.releaseDate,name,number");
    url.searchParams.set("pageSize", "12");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Pokemon TCG API returned ${response.status}`);
    }

    const payload = await response.json();
    renderResults(payload.data ?? [], query, fromScan);
  } catch (error) {
    statusText.textContent = "Catalog search failed. Check your internet connection and try again.";
  }
}

function renderResults(cards, query, fromScan) {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scoredCards = cards
    .map((card) => {
      const haystack = `${card.name} ${card.set.name} ${card.number} ${card.rarity ?? ""}`.toLowerCase();
      const score = queryTerms.filter((term) => haystack.includes(term)).length;
      return { card, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.card);

  statusText.textContent = scoredCards.length
    ? fromScan
      ? "Live matches found. Pick the exact card."
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
    meta.textContent = `${card.set.name} · ${card.number} · ${card.rarity ?? "Unknown rarity"}`;
    price.textContent = getDisplayPrice(card);
    content.append(name, meta, price);
    button.append(image, content);
    button.addEventListener("click", () => selectCard(card));
    catalogResults.appendChild(button);
  });
}

function selectCard(card) {
  selectedCard = card;
  activeRecord = null;
  stopCardScan();
  catalogResultsShell.classList.remove("catalog-results-shell--popup");
  selectedCardImage.src = card.images?.small ?? "";
  selectedCardName.textContent = card.name;
  selectedCardMeta.textContent = `${card.set.name} · ${card.number} · ${card.rarity ?? "Unknown rarity"}`;
  selectedCardPanel.hidden = false;
  qrOutputPanel.hidden = true;
  qrPreview.hidden = true;
  printQrButton.hidden = true;
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
    searchCards({ fromScan: true });
  }, 450);
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
    statusText.textContent = "Hold the card in frame. Matching results will appear below.";
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

  saveCreatedCard({
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
  });

  return { code, variant, condition, language };
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

  const { code, variant, condition } = saveSelectedCardRecord();
  const record = saveQrCode({
    code,
    mode: "code",
    payload: code,
  });

  renderQrRecord(record, `${selectedCard.name} · ${variant} · ${condition}`);
  statusText.textContent = "QR code generated and card info stored in the local demo database.";
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
    mode: "code",
    payload: normalized,
  });
  renderQrRecord(record, normalized);
  statusText.textContent = "Saved QR loaded. You can print it again or search for another card.";
}

searchButton.addEventListener("click", () => {
  searchCards();
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    searchCards();
  }
});

searchInput.addEventListener("input", () => {
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
  catalogResultsShell.hidden = true;
  catalogResultsShell.classList.remove("catalog-results-shell--popup");
});

window.addEventListener("beforeunload", () => {
  stopCardScan();
});

applyUrlParams();
