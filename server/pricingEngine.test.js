import test from 'node:test';
import assert from 'node:assert/strict';
import { applySale, normalizeDrink, resetPriceChanges } from './pricingEngine.js';
import { broadcastMarketUpdate } from './websocket.js';

const baseDrinks = [
  { id: 'WHIS', name: 'Виски', price: 10, volume: 0, minPrice: 8, maxPrice: 20, roundingStep: 0.1 },
  { id: 'GIN', name: 'Джин', price: 10, volume: 0, minPrice: 8, maxPrice: 20, roundingStep: 0.1 },
  { id: 'BEER', name: 'Пиво', price: 10, volume: 0, minPrice: 8, maxPrice: 20, roundingStep: 0.1 }
];

test('purchase impact raises whiskey and lowers every other active drink', () => {
  const next = applySale(baseDrinks, 'WHIS', 1, { mode: 'purchaseImpact' });
  assert.equal(next.find((drink) => drink.id === 'WHIS').rawPrice, 10.3);
  assert.equal(next.find((drink) => drink.id === 'GIN').rawPrice, 9.95);
  assert.equal(next.find((drink) => drink.id === 'BEER').rawPrice, 9.95);
  assert.equal(next.find((drink) => drink.id === 'WHIS').price, 10.3);
  assert.equal(next.find((drink) => drink.id === 'GIN').price, 10);
});

test('small decreases accumulate in raw price and appear after repeated purchases', () => {
  let next = baseDrinks;
  next = applySale(next, 'WHIS', 1, { mode: 'purchaseImpact' });
  assert.equal(next.find((drink) => drink.id === 'GIN').price, 10);
  next = applySale(next, 'WHIS', 1, { mode: 'purchaseImpact' });
  assert.equal(next.find((drink) => drink.id === 'GIN').rawPrice, 9.90025);
  assert.equal(next.find((drink) => drink.id === 'GIN').price, 9.9);
});

test('price never goes below minPrice or above maxPrice', () => {
  const bounded = [
    normalizeDrink({ id: 'LOW', price: 8, minPrice: 7.5, maxPrice: 20, roundingStep: 0.1 }),
    normalizeDrink({ id: 'HIGH', price: 19.9, minPrice: 7.5, maxPrice: 20, roundingStep: 0.1 })
  ];
  const lowered = applySale(bounded, 'HIGH', 1, { mode: 'purchaseImpact' });
  assert.equal(lowered.find((drink) => drink.id === 'LOW').rawPrice, 7.96);
  const raised = applySale(lowered, 'HIGH', 10, { mode: 'purchaseImpact' });
  assert.equal(raised.find((drink) => drink.id === 'HIGH').rawPrice, 20);
  assert.ok(raised.every((drink) => drink.rawPrice >= drink.minPrice && drink.rawPrice <= drink.maxPrice));
});

test('chart reset clears percentages without changing prices', () => {
  const changed = baseDrinks.map((drink, index) => ({ ...drink, rawPrice: drink.price + index * 0.25, change: index + 1 }));
  const reset = resetPriceChanges(changed);
  assert.ok(reset.every((drink) => drink.change === 0));
  assert.deepEqual(reset.map(({ price, rawPrice }) => ({ price, rawPrice })), changed.map(({ price, rawPrice }) => ({ price, rawPrice })));
});

test('all websocket clients receive the same full market state', () => {
  const clients = [{ readyState: 1, send(message) { this.message = message; } }, { readyState: 1, send(message) { this.message = message; } }];
  const market = { type: 'market_update', drinks: applySale(baseDrinks, 'WHIS', 1), timestamp: 123 };
  broadcastMarketUpdate(clients, market);
  assert.deepEqual(JSON.parse(clients[0].message), market);
  assert.deepEqual(JSON.parse(clients[1].message), market);
  assert.equal(JSON.parse(clients[0].message).drinks.length, 3);
});
