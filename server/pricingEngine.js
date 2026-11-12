const DEFAULT_RULES = {
  mode: 'purchaseImpact',
  purchaseIncrease: 0.03,
  otherDrinkDecrease: 0.005,
  roundingStep: 0.01,
  minPrice: 0,
  maxPrice: Number.POSITIVE_INFINITY
};

export function roundToStep(value, step = 0.01) {
  if (!Number.isFinite(step) || step <= 0) return value;
  const precision = Math.max(0, (String(step).split('.')[1] || '').length + 4);
  return Number((Math.round((value / step) + 1e-9) * step).toFixed(precision));
}

export function clampPrice(value, minPrice = 0, maxPrice = Number.POSITIVE_INFINITY) {
  return Math.min(maxPrice, Math.max(minPrice, value));
}

export function normalizeDrink(drink, rules = {}) {
  const merged = { ...DEFAULT_RULES, ...rules };
  const rawPrice = Number.isFinite(drink.rawPrice) ? drink.rawPrice : Number(drink.price);
  const minPrice = Number.isFinite(drink.minPrice) ? drink.minPrice : merged.minPrice;
  const maxPrice = Number.isFinite(drink.maxPrice) ? drink.maxPrice : merged.maxPrice;
  const roundingStep = Number.isFinite(drink.roundingStep) ? drink.roundingStep : merged.roundingStep;
  const boundedRawPrice = clampPrice(rawPrice, minPrice, maxPrice);
  return {
    ...drink,
    rawPrice: boundedRawPrice,
    minPrice,
    maxPrice,
    roundingStep,
    price: clampPrice(roundToStep(boundedRawPrice, roundingStep), minPrice, maxPrice)
  };
}

export function applyPurchaseImpact(drinks, drinkId, quantity = 1, rules = {}) {
  const merged = { ...DEFAULT_RULES, ...rules };
  const count = Math.max(1, Math.floor(Number(quantity) || 1));
  const normalized = drinks.map((drink) => normalizeDrink(drink, merged));
  const selected = normalized.find((drink) => drink.id === drinkId);
  if (!selected || selected.active === false) throw new Error(`Unknown or inactive drink: ${drinkId}`);

  return normalized.map((drink) => {
    if (drink.active === false) return drink;
    const isPurchased = drink.id === drinkId;
    const factor = isPurchased
      ? Math.pow(1 + merged.purchaseIncrease, count)
      : Math.pow(1 - merged.otherDrinkDecrease, count);
    const rawPrice = clampPrice(drink.rawPrice * factor, drink.minPrice, drink.maxPrice);
    return { ...drink, rawPrice, price: clampPrice(roundToStep(rawPrice, drink.roundingStep), drink.minPrice, drink.maxPrice), volume: drink.volume + (isPurchased ? count : 0) };
  });
}

export function applySale(drinks, drinkId, quantity = 1, rules = {}) {
  const merged = { ...DEFAULT_RULES, ...rules };
  if (merged.mode === 'demandBased') {
    return applyDemandBased(drinks, drinkId, quantity, merged);
  }
  return applyPurchaseImpact(drinks, drinkId, quantity, merged);
}

export function setManualPrice(drinks, drinkId, price, rules = {}) {
  const normalized = drinks.map((drink) => normalizeDrink(drink, rules));
  const target = normalized.find((drink) => drink.id === drinkId);
  if (!target || target.active === false) throw new Error(`Unknown or inactive drink: ${drinkId}`);
  const rawPrice = clampPrice(Number(price), target.minPrice, target.maxPrice);
  return normalized.map((drink) => drink.id === drinkId
    ? { ...drink, rawPrice, price: clampPrice(roundToStep(rawPrice, drink.roundingStep), drink.minPrice, drink.maxPrice) }
    : drink);
}

function applyDemandBased(drinks, drinkId, quantity, rules) {
  const count = Math.max(1, Math.floor(Number(quantity) || 1));
  return drinks.map((drink) => {
    const normalized = normalizeDrink(drink, rules);
    const rawPrice = clampPrice(normalized.rawPrice * (normalized.id === drinkId ? Math.pow(1 + rules.purchaseIncrease, count) : 1), normalized.minPrice, normalized.maxPrice);
    return { ...normalized, rawPrice, price: clampPrice(roundToStep(rawPrice, normalized.roundingStep), normalized.minPrice, normalized.maxPrice), volume: normalized.volume + (normalized.id === drinkId ? count : 0) };
  });
}

export { DEFAULT_RULES };
