const STORAGE_KEY = "sleeveScanCreatedCards";

export function getCreatedCards() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch (error) {
    return [];
  }
}

export function getCreatedCardByCode(code) {
  const normalized = code?.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  return getCreatedCards().find((card) => card.code === normalized) ?? null;
}

export function saveCreatedCard(card) {
  const savedCards = getCreatedCards();
  const nextCard = {
    ...card,
    code: card.code.trim().toLowerCase(),
    updatedAt: new Date().toISOString(),
    createdAt: card.createdAt ?? new Date().toISOString(),
  };
  const nextSavedCards = savedCards.filter((item) => item.code !== nextCard.code);
  nextSavedCards.push(nextCard);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSavedCards));
  return nextCard;
}
