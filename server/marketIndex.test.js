import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBarPriceIndex } from '../src/marketIndex.js';

test('bar price index equals 100 at base prices', () => {
  assert.equal(calculateBarPriceIndex([
    { basePrice: 100, rawPrice: 100, active: true },
    { basePrice: 200, rawPrice: 200, active: true }
  ]), 100);
});

test('bar price index reports percentage movement from base 100', () => {
  assert.equal(calculateBarPriceIndex([
    { basePrice: 100, rawPrice: 110, active: true },
    { basePrice: 200, rawPrice: 220, active: true }
  ]), 110);
});

test('bar price index uses precise raw prices and ignores inactive drinks', () => {
  assert.equal(calculateBarPriceIndex([
    { basePrice: 100, rawPrice: 99.5, price: 100, active: true },
    { basePrice: 100, rawPrice: 300, active: false }
  ]), 99.5);
});
