import { getPricingCardByCode } from "./livePricing.js";

const detailName = document.querySelector("#detail-name");
const detailGrade = document.querySelector("#detail-grade");
const detailMeta = document.querySelector("#detail-meta");
const detailIcon = document.querySelector("#detail-icon");
const detailPrice = document.querySelector("#detail-price");
const detailTrend24h = document.querySelector("#detail-trend24h");
const detailRange = document.querySelector("#detail-range");
const detailLow = document.querySelector("#detail-low");
const detailHigh = document.querySelector("#detail-high");
const detailComps = document.querySelector("#detail-comps");
const trendLine = document.querySelector("#trend-line");
const trendLabels = document.querySelector("#trend-labels");

function getRequestedCard() {
  const params = new URLSearchParams(window.location.search);
  return params.get("card") ?? "raw:charizard-base-4";
}

function createTrendPath(values) {
  const width = 680;
  const height = 220;
  const padding = 18;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);
  const stepX = (width - padding * 2) / Math.max(values.length - 1, 1);

  return values
    .map((value, index) => {
      const x = padding + stepX * index;
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function renderLabels(labels) {
  trendLabels.innerHTML = "";
  labels.forEach((label) => {
    const span = document.createElement("span");
    span.textContent = label;
    trendLabels.appendChild(span);
  });
}

function renderComps(comps) {
  detailComps.innerHTML = "";

  comps.forEach((comp) => {
    const row = document.createElement("article");
    row.className = "detail-comp";
    row.innerHTML = `
      <div class="detail-comp__main">
        <div class="detail-comp__meta">
          <span class="detail-comp__source">${comp.source}</span>
          <span>${comp.date}</span>
        </div>
        <strong>${comp.note}</strong>
      </div>
      <div class="detail-comp__price-wrap">
        <span class="detail-comp__price">${comp.price}</span>
        <span class="detail-comp__arrow">↗</span>
      </div>
    `;
    detailComps.appendChild(row);
  });
}

function getDisplayIcon(icon) {
  const icons = {
    FIRE: "🔥",
    WATER: "🌊",
    MOON: "🌙",
    ELECTRIC: "⚡",
  };

  return icons[icon] ?? icon ?? "?";
}

function renderCard(card) {
  if (!card) {
    detailName.textContent = "Card not found";
    detailGrade.textContent = "No data";
    detailMeta.textContent = "Add this code to your Google Sheet or try a sample card.";
    detailIcon.textContent = "?";
    detailPrice.textContent = "--";
    detailTrend24h.textContent = "No comps yet";
    detailRange.textContent = "No pricing record was found for this sleeve code.";
    detailLow.textContent = "--";
    detailHigh.textContent = "--";
    trendLine.setAttribute("d", "");
    renderLabels([]);
    renderComps([]);
    return;
  }

  document.title = `SleeveScan · ${card.displayName}`;
  detailName.textContent = card.displayName;
  detailGrade.textContent = card.grade;
  detailMeta.textContent = card.heroMeta;
  detailIcon.textContent = getDisplayIcon(card.icon);
  detailPrice.textContent = card.marketPrice;
  detailTrend24h.textContent = `↗ ${card.trend24h}`;
  detailRange.textContent = card.marketRange;
  detailLow.textContent = card.low30d;
  detailHigh.textContent = card.high30d;
  trendLine.setAttribute("d", createTrendPath(card.chartValues));
  renderLabels(card.chartLabels);
  renderComps(card.comps);
}

renderCard(await getPricingCardByCode(getRequestedCard()));
