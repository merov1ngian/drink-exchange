export function calculateBarPriceIndex(drinks = []) {
  const activeDrinks = drinks.filter((drink) => drink.active !== false && Number(drink.basePrice) > 0);
  if (!activeDrinks.length) return 100;

  const relativePrices = activeDrinks.map((drink) => {
    const currentPrice = Number(drink.rawPrice ?? drink.price);
    return currentPrice / Number(drink.basePrice);
  });

  return Number(((relativePrices.reduce((sum, value) => sum + value, 0) / relativePrices.length) * 100).toFixed(2));
}
