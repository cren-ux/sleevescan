import { saveCreatedCard } from "./createdCards.js";
import { saveQrCode } from "./qrStore.js";

const searchInput = document.querySelector("#admin-search-input");
const searchButton = document.querySelector("#admin-search-button");
const statusText = document.querySelector("#admin-status");
const catalogResults = document.querySelector("#catalog-results");
const selectedCardPanel = document.querySelector("#selected-card-panel");
const selectedCardImage = document.querySelector("#selected-card-image");
const selectedCardName = document.querySelector("#selected-card-name");
const selectedCardMeta = document.querySelector("#selected-card-meta");
const variantSelect = document.querySelector("#variant-select");
const conditionSelect = document.querySelector("#condition-select");
const languageSelect = document.querySelector("#language-select");
const createQrButton = document.querySelector("#create-admin-qr-button");
const cardScanButton = document.querySelector("#card-scan-button");
const cardScanVideo = document.querySelector("#card-scan-video");
const catalogResultsShell = document.querySelector("#catalog-results-shell");
const closeResultsButton = document.querySelector("#close-results-button");

let selectedCard = null;
let scanStream = null;
let scanSearchTimer = null;

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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
    image.src = card.images.small;
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
  stopCardScan();
  catalogResultsShell.classList.remove("catalog-results-shell--popup");
  selectedCardImage.src = card.images.small;
  selectedCardName.textContent = card.name;
  selectedCardMeta.textContent = `${card.set.name} · ${card.number} · ${card.rarity ?? "Unknown rarity"}`;
  selectedCardPanel.hidden = false;
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

function createCardQr() {
  if (!selectedCard) {
    statusText.textContent = "Choose a catalog card first.";
    return;
  }

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

  saveQrCode({
    code,
    mode: "code",
    payload: code,
  });

  window.location.href = `./qr.html?code=${encodeURIComponent(code)}&mode=code`;
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

createQrButton.addEventListener("click", createCardQr);

cardScanButton.addEventListener("click", startCardScan);

searchInput.addEventListener("input", () => {
  scheduleLiveScanSearch();
});

closeResultsButton.addEventListener("click", () => {
  catalogResultsShell.hidden = true;
  catalogResultsShell.classList.remove("catalog-results-shell--popup");
});

window.addEventListener("beforeunload", () => {
  stopCardScan();
});
