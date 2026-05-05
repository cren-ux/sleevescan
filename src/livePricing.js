import { GOOGLE_SHEETS_API_URL } from "./appConfig.js";
import { getCardByCode } from "./cardData.js";
import { getCreatedCardByCode } from "./createdCards.js";

function withFallbackDefaults(card, fallback) {
  const fallbackCard = fallback ?? {};

  return {
    ...fallbackCard,
    ...card,
    chartLabels: card.chartLabels?.length ? card.chartLabels : fallbackCard.chartLabels ?? [],
    chartValues: card.chartValues?.length ? card.chartValues : fallbackCard.chartValues ?? [],
    comps: card.comps?.length ? card.comps : fallbackCard.comps ?? [],
  };
}

async function fetchSheetCard(code) {
  if (!GOOGLE_SHEETS_API_URL) {
    return null;
  }

  const url = new URL(GOOGLE_SHEETS_API_URL);
  url.searchParams.set("code", code);

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Pricing API returned ${response.status}`);
    }

    const payload = await response.json();
    return payload.card ?? null;
  } catch (error) {
    return fetchSheetCardWithJsonp(url);
  }
}

function fetchSheetCardWithJsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = `sleeveScanCallback${Date.now()}`;
    const script = document.createElement("script");

    url.searchParams.set("callback", callbackName);

    window[callbackName] = (payload) => {
      resolve(payload.card ?? null);
      script.remove();
      delete window[callbackName];
    };

    script.onerror = () => {
      reject(new Error("Pricing API JSONP request failed"));
      script.remove();
      delete window[callbackName];
    };

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

export async function getPricingCardByCode(code) {
  const normalized = code?.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  const fallback = getCardByCode(normalized);

  try {
    const sheetCard = await fetchSheetCard(normalized);
    if (sheetCard) {
      return withFallbackDefaults(sheetCard, fallback);
    }
  } catch (error) {
    console.warn("Using local demo pricing data:", error);
  }

  const createdCard = getCreatedCardByCode(normalized);

  if (createdCard) {
    return withFallbackDefaults(createdCard, fallback);
  }

  return fallback;
}
