import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applySale, normalizeDrink, setManualPrice } from './pricingEngine.js';
import { broadcastMarketUpdate } from './websocket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

let drinks = [
  { id: 'NEGR', symbol: 'NEGR', name: 'Негрони', category: 'Классика', price: 9250, change: 4.2, volume: 38, color: '#d8a756' },
  { id: 'MARG', symbol: 'MARG', name: 'Острая Маргарита', category: 'Коктейль', price: 8000, change: 2.8, volume: 29, color: '#d8a756' },
  { id: 'OLDF', symbol: 'OLDF', name: 'Олд Фэшн', category: 'Классика', price: 9500, change: -1.7, volume: 24, color: '#c88746' },
  { id: 'MART', symbol: 'MART', name: 'Эспрессо Мартини', category: 'Коктейль', price: 8750, change: 3.1, volume: 35, color: '#9c6a48' },
  { id: 'PALO', symbol: 'PALO', name: 'Палома', category: 'Хайбол', price: 7500, change: -3.4, volume: 17, color: '#d5a964' },
  { id: 'SAWA', symbol: 'SAWA', name: 'Совиньон Блан', category: 'Вино', price: 7000, change: 1.2, volume: 21, color: '#d4cf93' },
  { id: 'GIML', symbol: 'GIML', name: 'Гимлет', category: 'Классика', price: 8250, change: -0.8, volume: 13, color: '#91a46e' },
  { id: 'TONI', symbol: 'TONI', name: 'Тоник с лаймом', category: 'Безалкогольное', price: 4750, change: 0.6, volume: 8, color: '#9cb9a4' }
].map((drink) => normalizeDrink({ ...drink, active: true, minPrice: 3000, maxPrice: 30000, roundingStep: 50 }, { mode: 'purchaseImpact' }));

const pricingRules = { mode: 'purchaseImpact', purchaseIncrease: 0.03, otherDrinkDecrease: 0.005 };
let tickerSettings = {
  speed: 90,
  fontSize: 64,
  visibleDrinkIds: drinks.map((drink) => drink.id)
};

function snapshot(type = 'snapshot', trade = undefined) {
  return { type, drinks: drinks.map((drink) => ({ ...drink })), tickerSettings: { ...tickerSettings, visibleDrinkIds: [...tickerSettings.visibleDrinkIds] }, marketOpen: true, timestamp: Date.now(), ...(trade ? { trade } : {}) };
}

function processTickerSettings(next = {}) {
  const validIds = new Set(drinks.filter((drink) => drink.active !== false).map((drink) => drink.id));
  const requestedIds = Array.isArray(next.visibleDrinkIds) ? next.visibleDrinkIds.filter((id) => validIds.has(id)) : tickerSettings.visibleDrinkIds;
  tickerSettings = {
    speed: Math.min(240, Math.max(20, Number(next.speed ?? tickerSettings.speed) || tickerSettings.speed)),
    fontSize: Math.min(140, Math.max(24, Number(next.fontSize ?? tickerSettings.fontSize) || tickerSettings.fontSize)),
    visibleDrinkIds: requestedIds.length ? [...new Set(requestedIds)] : tickerSettings.visibleDrinkIds
  };
  const update = { type: 'ticker_settings', tickerSettings: { ...tickerSettings, visibleDrinkIds: [...tickerSettings.visibleDrinkIds] }, timestamp: Date.now() };
  broadcastMarketUpdate(wss.clients, update);
  return update;
}

function processPurchase(drinkId, quantity = 1, buyer = 'Симулятор') {
  const previous = new Map(drinks.map((drink) => [drink.id, drink]));
  drinks = applySale(drinks, drinkId, quantity, pricingRules).map((drink) => {
    const oldDrink = previous.get(drink.id);
    const rawChange = oldDrink?.rawPrice ? ((drink.rawPrice / oldDrink.rawPrice) - 1) * 100 : 0;
    return { ...drink, change: Number((drink.change + rawChange).toFixed(1)) };
  });
  const purchased = drinks.find((drink) => drink.id === drinkId);
  const trade = { drinkId, price: purchased.price, rawPrice: purchased.rawPrice, quantity, timestamp: Date.now(), buyer };
  const update = snapshot('market_update', trade);
  broadcastMarketUpdate(wss.clients, update);
  return update;
}

function processManualPriceUpdate(drinkId, price) {
  const previous = drinks.find((drink) => drink.id === drinkId);
  drinks = setManualPrice(drinks, drinkId, price, pricingRules);
  const updated = drinks.find((drink) => drink.id === drinkId);
  const change = previous?.rawPrice ? ((updated.rawPrice / previous.rawPrice) - 1) * 100 : 0;
  drinks = drinks.map((drink) => drink.id === drinkId ? { ...drink, change: Number(change.toFixed(1)) } : drink);
  const update = snapshot('market_update', { type: 'price_update', drinkId, price: updated.price, rawPrice: updated.rawPrice, change: Number(change.toFixed(1)), timestamp: Date.now(), buyer: 'Каталог' });
  broadcastMarketUpdate(wss.clients, update);
  return update;
}

setInterval(() => {
  const drink = drinks[Math.floor(Math.random() * drinks.length)];
  processPurchase(drink.id, 1, ['Стол 12', 'Гость', 'Стол 07', 'Бар'][Math.floor(Math.random() * 4)]);
}, 5500);

wss.on('connection', (socket) => {
  socket.send(JSON.stringify(snapshot()));
  socket.on('message', (raw) => {
    try {
      const body = JSON.parse(raw.toString());
      if (body.type === 'simulate') {
        const drinkId = drinks.some((item) => item.id === body.drinkId) ? body.drinkId : drinks[0].id;
        processPurchase(drinkId, body.quantity, 'Симулятор');
      }
      if (body.type === 'set_price') processManualPriceUpdate(body.drinkId, body.price);
      if (body.type === 'ticker_settings') processTickerSettings(body.settings);
    } catch { /* ignore malformed simulator input */ }
  });
});

app.use(express.json());
app.get('/api/market', (_req, res) => res.json(snapshot()));
app.post('/api/simulate', (req, res) => {
  const drinkId = drinks.some((item) => item.id === req.body.drinkId) ? req.body.drinkId : drinks[0].id;
  const quantity = Math.max(1, Number(req.body.quantity || 1));
  const update = processPurchase(drinkId, quantity, 'Симулятор');
  res.json({ ok: true, ...update });
});
app.put('/api/catalog/:drinkId/price', (req, res) => {
  try {
    const update = processManualPriceUpdate(req.params.drinkId, req.body.price);
    res.json({ ok: true, ...update });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});
app.put('/api/ticker-settings', (req, res) => res.json({ ok: true, ...processTickerSettings(req.body) }));

const dist = path.resolve(__dirname, '../dist');
app.use(express.static(dist));
app.use((_req, res) => res.sendFile(path.join(dist, 'index.html')));

const port = process.env.PORT || 3001;
httpServer.listen(port, () => console.log(`Drink Exchange server listening on ${port}`));
