import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, Bell, ChevronDown, CircleHelp, Clock3, Flame, Maximize2, Menu, Radio, RotateCcw, Search, Settings2, ShoppingBag, Wifi, X } from 'lucide-react';
import './styles.css';
import { calculateBarPriceIndex } from './marketIndex.js';

const chartData = [
  { time: '18:00', value: 64 }, { time: '18:15', value: 67 }, { time: '18:30', value: 66 }, { time: '18:45', value: 72 },
  { time: '19:00', value: 70 }, { time: '19:15', value: 75 }, { time: '19:30', value: 78 }, { time: '19:45', value: 76 },
  { time: '20:00', value: 82 }, { time: '20:15', value: 86 }, { time: '20:30', value: 84 }
];
const seedDrinks = [
  { id: 'NEGR', symbol: 'NEGR', name: 'Негрони', category: 'Классика', price: 9250, change: 4.2, volume: 38, color: '#d8a756' },
  { id: 'MARG', symbol: 'MARG', name: 'Острая Маргарита', category: 'Коктейль', price: 8000, change: 2.8, volume: 29, color: '#d8a756' },
  { id: 'OLDF', symbol: 'OLDF', name: 'Олд Фэшн', category: 'Классика', price: 9500, change: -1.7, volume: 24, color: '#c88746' },
  { id: 'MART', symbol: 'MART', name: 'Эспрессо Мартини', category: 'Коктейль', price: 8750, change: 3.1, volume: 35, color: '#9c6a48' },
  { id: 'PALO', symbol: 'PALO', name: 'Палома', category: 'Хайбол', price: 7500, change: -3.4, volume: 17, color: '#d5a964' },
  { id: 'SAWA', symbol: 'SAWA', name: 'Совиньон Блан', category: 'Вино', price: 7000, change: 1.2, volume: 21, color: '#d4cf93' },
  { id: 'GIML', symbol: 'GIML', name: 'Гимлет', category: 'Классика', price: 8250, change: -0.8, volume: 13, color: '#91a46e' },
  { id: 'TONI', symbol: 'TONI', name: 'Тоник с лаймом', category: 'Безалкогольное', price: 4750, change: 0.6, volume: 8, color: '#9cb9a4' }
].map((drink) => ({ ...drink, basePrice: drink.price, rawPrice: drink.price, active: true }));
const formatPrice = (value) => `${Math.round(Number(value)).toLocaleString('ru-RU')} ₸`;
const defaultTickerSettings = { speed: 90, fontSize: 64, visibleDrinkIds: seedDrinks.map((drink) => drink.id) };
const buildPriceHistory = (drink) => {
  const sessionStart = drink.price / (1 + drink.change / 100);
  return chartData.map((point, index) => {
    const progress = index / (chartData.length - 1);
    const trend = sessionStart + (drink.price - sessionStart) * progress;
    const noise = (point.value - 76) * drink.price * 0.00035 * Math.sin(progress * Math.PI);
    return { time: point.time, value: Math.round(index === chartData.length - 1 ? drink.price : trend + noise) };
  });
};
const buildPriceHistories = (drinks) => Object.fromEntries(drinks.map((drink) => [drink.id, buildPriceHistory(drink)]));

function useMarket() {
  const [drinks, setDrinks] = useState(seedDrinks);
  const [tickerSettings, setTickerSettings] = useState(defaultTickerSettings);
  const initialMarketHistory = useMemo(() => [{ time: 'База', value: 100 }], []);
  const [marketHistory, setMarketHistory] = useState(initialMarketHistory);
  const [priceHistories, setPriceHistories] = useState(() => buildPriceHistories(seedDrinks));
  const marketHistoryRef = useRef(initialMarketHistory);
  const priceHistoriesRef = useRef(buildPriceHistories(seedDrinks));
  const [events, setEvents] = useState([
    { time: '20:36:12', buyer: 'Стол 12', drink: 'Негрони', quantity: 2, amount: 18500 },
    { time: '20:35:48', buyer: 'Бар', drink: 'Острая Маргарита', quantity: 1, amount: 8000 },
    { time: '20:34:22', buyer: 'Гость', drink: 'Эспрессо Мартини', quantity: 2, amount: 17500 },
    { time: '20:33:51', buyer: 'Стол 07', drink: 'Олд Фэшн', quantity: 1, amount: 19000 }
  ]);
  const socketRef = useRef(null);
  const applyChartReset = (sourceDrinks, timestamp = Date.now()) => {
    const currentValue = calculateBarPriceIndex(sourceDrinks);
    const currentTime = new Date(timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const resetHistory = [{ time: 'Сброс', value: currentValue }, { time: currentTime, value: currentValue }];
    const resetPriceHistories = Object.fromEntries(sourceDrinks.map((drink) => [drink.id, [
      { time: 'Сброс', value: drink.price },
      { time: currentTime, value: drink.price }
    ]]));
    marketHistoryRef.current = resetHistory;
    priceHistoriesRef.current = resetPriceHistories;
    setMarketHistory(resetHistory);
    setPriceHistories(resetPriceHistories);
  };
  useEffect(() => {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${location.hostname}:3001/ws`);
    socketRef.current = socket;
    socket.onmessage = (message) => {
      const data = JSON.parse(message.data);
      if (data.type === 'snapshot') {
        setDrinks(data.drinks);
        if (data.tickerSettings) setTickerSettings(data.tickerSettings);
        const histories = buildPriceHistories(data.drinks);
        priceHistoriesRef.current = histories;
        setPriceHistories(histories);
        const indexValue = calculateBarPriceIndex(data.drinks);
        const snapshotHistory = [{ time: 'База', value: 100 }, { time: new Date(data.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), value: indexValue }];
        marketHistoryRef.current = snapshotHistory;
        setMarketHistory(snapshotHistory);
      }
      if (data.type === 'market_update') {
        setDrinks(data.drinks);
        if (data.tickerSettings) setTickerSettings(data.tickerSettings);
        const pointTime = new Date(data.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const nextPriceHistories = Object.fromEntries(data.drinks.map((drink) => {
          const current = priceHistoriesRef.current[drink.id] || buildPriceHistory(drink);
          return [drink.id, [...current.slice(-20), { time: pointTime, value: drink.price }]];
        }));
        priceHistoriesRef.current = nextPriceHistories;
        setPriceHistories(nextPriceHistories);
        const nextValue = calculateBarPriceIndex(data.drinks);
        const nextHistory = [...marketHistoryRef.current.slice(-20), { time: new Date(data.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), value: nextValue }];
        marketHistoryRef.current = nextHistory;
        setMarketHistory(nextHistory);
        const drink = data.drinks.find((item) => item.id === data.trade?.drinkId);
        if (drink) setEvents((current) => [{ time: new Date(data.trade.timestamp).toLocaleTimeString('ru-RU'), buyer: data.trade.buyer, drink: drink.name, quantity: data.trade.quantity, amount: data.trade.price }, ...current].slice(0, 8));
      }
      if (data.type === 'ticker_settings') setTickerSettings(data.tickerSettings);
      if (data.type === 'charts_reset') {
        if (data.drinks) setDrinks(data.drinks);
        applyChartReset(data.drinks || seedDrinks, data.timestamp);
      }
    };
    return () => socket.close();
  }, []);
  const simulate = (drinkId, quantity = 1) => socketRef.current?.send(JSON.stringify({ type: 'simulate', drinkId, quantity }));
  const setPrice = (drinkId, price) => socketRef.current?.send(JSON.stringify({ type: 'set_price', drinkId, price: Number(price) }));
  const updateTickerSettings = (settings) => socketRef.current?.send(JSON.stringify({ type: 'ticker_settings', settings }));
  const resetChartHistories = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify({ type: 'reset_charts' }));
    else applyChartReset(drinks);
  };
  return { drinks, events, marketHistory, priceHistories, tickerSettings, simulate, setPrice, updateTickerSettings, resetChartHistories };
}

function Header({ admin = false }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(id); }, []);
  return <header className="topbar">
    <div className="brand"><div className="brand-mark">◆</div><div><div className="brand-name">DRINK <span>{admin ? 'EXCHANGE OFFICE' : 'EXCHANGE'}</span></div><div className="brand-sub">{admin ? 'УПРАВЛЕНИЕ РЕСТОРАНОМ' : 'ЖИВАЯ АНАЛИТИКА РЫНКА'}</div></div></div>
    <div className="market-state"><span className="pulse" /> <span>РЫНОК ОТКРЫТ</span><span className="state-divider" /><Clock3 size={14} /> <strong>{time.toLocaleTimeString('ru-RU')}</strong><span className="tz">GMT+5</span></div>
    {admin ? <div className="header-actions"><div className="user-chip">A <span>Администратор</span><ChevronDown size={14} /></div></div> : <div className="live-pill"><Wifi size={13} /> ОНЛАЙН</div>}
  </header>;
}

function Change({ value }) { return <span className={value >= 0 ? 'change up' : 'change down'}>{value >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}{Math.abs(value).toFixed(1)}%</span>; }

function Sparkline({ positive = true }) { return <svg className="sparkline" viewBox="0 0 100 30" preserveAspectRatio="none"><polyline fill="none" stroke={positive ? '#66d69a' : '#e46d70'} strokeWidth="2" points={positive ? '0,25 12,22 23,24 34,15 46,18 58,10 68,13 79,6 90,9 100,2' : '0,6 12,9 23,8 34,15 46,12 58,18 68,14 79,22 90,18 100,27'} /></svg>; }

function TickerItem({ drink }) {
  const rising = drink.change >= 0;
  return <div className="led-quote">
    <span className="led-name">{drink.name}</span>
    <span className="led-price">{formatPrice(drink.price)}</span>
    <span className={rising ? 'led-change led-up' : 'led-change led-down'}>{rising ? '▲' : '▼'} {Math.abs(drink.change).toFixed(1)}%</span>
    <span className="led-separator" aria-hidden="true" />
  </div>;
}

function PublicTicker({ drinks, tickerSettings }) {
  const groupRef = useRef(null);
  const [duration, setDuration] = useState(30);
  const visibleKey = tickerSettings.visibleDrinkIds.join('|');
  const visibleDrinks = useMemo(() => {
    const selected = drinks.filter((drink) => tickerSettings.visibleDrinkIds.includes(drink.id));
    return selected.length ? selected : drinks;
  }, [drinks, visibleKey]);

  useEffect(() => {
    let cancelled = false;
    const measure = () => {
      if (!cancelled && groupRef.current) setDuration(Math.max(6, groupRef.current.scrollWidth / tickerSettings.speed));
    };
    const frame = requestAnimationFrame(measure);
    document.fonts?.ready.then(measure);
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [tickerSettings.speed, tickerSettings.fontSize, visibleKey]);

  return <main className="ticker-screen" style={{ '--ticker-font-size': `${tickerSettings.fontSize}px`, '--ticker-duration': `${duration}s` }}>
    <div className="ticker-viewport" aria-label="Биржевая лента цен напитков">
      <div className="ticker-track">
        <div className="ticker-group" ref={groupRef}>{visibleDrinks.map((drink) => <TickerItem key={drink.id} drink={drink} />)}</div>
        <div className="ticker-group" aria-hidden="true">{visibleDrinks.map((drink) => <TickerItem key={drink.id} drink={drink} />)}</div>
      </div>
    </div>
  </main>;
}

function TickerSettingsPanel({ drinks, tickerSettings, updateTickerSettings }) {
  const toggleDrink = (drinkId) => {
    const visible = tickerSettings.visibleDrinkIds.includes(drinkId);
    const nextIds = visible ? tickerSettings.visibleDrinkIds.filter((id) => id !== drinkId) : [...tickerSettings.visibleDrinkIds, drinkId];
    if (nextIds.length) updateTickerSettings({ visibleDrinkIds: nextIds });
  };
  return <div className="ticker-settings-grid">
    <section className="panel ticker-controls"><div className="panel-heading"><div><span className="eyebrow">ВТОРОЙ МОНИТОР</span><h2>Настройки бегущей строки</h2></div><a className="display-link ticker-open-link" href="/ticker" target="_blank" rel="noreferrer"><Maximize2 size={15} /> Открыть /ticker</a></div>
      <div className="ticker-control-row"><label><span>СКОРОСТЬ ПРОКРУТКИ</span><b>{tickerSettings.speed} пикс/с</b><input type="range" min="20" max="240" step="5" value={tickerSettings.speed} onChange={(event) => updateTickerSettings({ speed: Number(event.target.value) })} /></label></div>
      <div className="ticker-control-row"><label><span>РАЗМЕР ТЕКСТА</span><b>{tickerSettings.fontSize} px</b><input type="range" min="24" max="140" step="2" value={tickerSettings.fontSize} onChange={(event) => updateTickerSettings({ fontSize: Number(event.target.value) })} /></label></div>
    </section>
    <section className="panel ticker-drinks-panel"><div className="panel-heading"><div><span className="eyebrow">СОСТАВ ЛЕНТЫ</span><h2>Отображаемые напитки</h2></div><span className="ticker-count">{tickerSettings.visibleDrinkIds.length} / {drinks.length}</span></div><div className="ticker-drink-options">{drinks.map((drink) => <label className="ticker-drink-option" key={drink.id}><input type="checkbox" checked={tickerSettings.visibleDrinkIds.includes(drink.id)} onChange={() => toggleDrink(drink.id)} /><span><b>{drink.name}</b><small>{drink.symbol} · {formatPrice(drink.price)}</small></span></label>)}</div></section>
  </div>;
}

function MarketDisplayClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const timer = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(timer); }, []);
  return <div className="market-display-clock"><strong>{time.toLocaleTimeString('ru-RU')}</strong><span>ASTANA (GMT+5)</span></div>;
}

function MiniPriceChart({ history, positive, id }) {
  const values = history.map((point) => point.value);
  const min = Math.min(...values); const max = Math.max(...values); const range = Math.max(1, max - min);
  const points = values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * 100},${28 - ((value - min) / range) * 24}`).join(' ');
  const color = positive ? '#00ed72' : '#ff3944';
  return <svg className="market-mini-chart" viewBox="0 0 100 30" preserveAspectRatio="none"><defs><linearGradient id={`mini-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".52" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs><polygon points={`0,30 ${points} 100,30`} fill={`url(#mini-${id})`} /><polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>;
}

function BottomQuote({ drink }) {
  return <div className="bottom-quote"><span>{drink.symbol}</span><b>{formatPrice(drink.price)}</b><strong className={drink.change >= 0 ? 'positive' : 'negative'}>{drink.change >= 0 ? '▲ +' : '▼ −'}{Math.abs(drink.change).toFixed(1)}%</strong></div>;
}

function DisplayBottomTicker({ drinks, speed = 80 }) {
  const groupRef = useRef(null);
  const [duration, setDuration] = useState(30);
  const drinkOrderKey = drinks.map((drink) => drink.id).join('|');

  useEffect(() => {
    let cancelled = false;
    const measure = () => {
      if (!cancelled && groupRef.current) setDuration(Math.max(8, groupRef.current.scrollWidth / Math.max(20, speed)));
    };
    const frame = requestAnimationFrame(measure);
    document.fonts?.ready.then(measure);
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [speed, drinkOrderKey]);

  return <footer className="market-bottom-tape" style={{ '--display-tape-duration': `${duration}s` }} aria-label="Бегущая строка цен напитков">
    <div className="market-bottom-track">
      <div className="market-bottom-group" ref={groupRef}>{drinks.map((drink) => <BottomQuote drink={drink} key={drink.id} />)}</div>
      <div className="market-bottom-group" aria-hidden="true">{drinks.map((drink) => <BottomQuote drink={drink} key={drink.id} />)}</div>
    </div>
  </footer>;
}

function Display({ drinks, priceHistories, tickerSettings }) {
  const [selected, setSelected] = useState(null);
  const rankedDrinks = useMemo(() => drinks
    .map((drink, index) => ({ drink, index }))
    .sort((left, right) => right.drink.change - left.drink.change || left.index - right.index)
    .map(({ drink }) => drink), [drinks]);
  const rankingKey = rankedDrinks.map((drink) => drink.id).join('|');
  const selectedDrink = rankedDrinks.find((drink) => drink.id === selected) || rankedDrinks[0];

  useEffect(() => {
    if (rankedDrinks.length < 2) return undefined;
    const rankedIds = rankedDrinks.map((drink) => drink.id);
    const timer = setInterval(() => {
      setSelected((current) => {
        const currentIndex = rankedIds.indexOf(current);
        const visibleIndex = currentIndex < 0 ? 0 : currentIndex;
        return rankedIds[(visibleIndex + 1) % rankedIds.length];
      });
    }, 10000);
    return () => clearInterval(timer);
  }, [rankingKey]);

  const selectedHistory = priceHistories[selectedDrink.id] || buildPriceHistory(selectedDrink);
  const positive = selectedDrink.change >= 0;
  const chartColor = positive ? '#00ed72' : '#ff3944';
  const basePrice = Math.round((selectedDrink.price / (1 + selectedDrink.change / 100)) / 50) * 50;
  const selectedNameParts = selectedDrink.name.split(' ');
  const selectedNameAccent = selectedNameParts.pop();
  const selectedNameLead = selectedNameParts.join(' ');
  return <main className="market-display-v2">
    <header className="market-display-header"><div className="market-display-title">BAR MARKET INDEX</div><div className="market-display-meta"><div className="market-open-pill"><span /> MARKET OPEN</div><MarketDisplayClock /></div></header>
    <section className="market-terminal-board">
      <div className="market-instruments">
        <div className="market-table-header"><span>НАПИТОК</span><span>ЦЕНА</span><span>ИЗМЕНЕНИЕ (24Ч)</span><span>ГРАФИК (24Ч)</span></div>
        <div className="market-table-body">{rankedDrinks.map((drink) => {
          const rising = drink.change >= 0; const history = priceHistories[drink.id] || buildPriceHistory(drink);
          return <button className={`market-instrument-row ${selectedDrink.id === drink.id ? 'selected' : ''}`} key={drink.id} onClick={() => setSelected(drink.id)}><span className="market-instrument-name">{drink.name}</span><span className="market-instrument-price">{formatPrice(drink.price)}</span><span className={rising ? 'market-instrument-change positive' : 'market-instrument-change negative'}>{rising ? '▲' : '▼'} {rising ? '+' : '−'}{Math.abs(drink.change).toFixed(1)}%</span><MiniPriceChart history={history} positive={rising} id={drink.id} /></button>;
        })}</div>
      </div>
      <article className="market-selected-detail" key={selectedDrink.id}>
        <div className="selected-detail-heading"><h1>{selectedNameLead && <span>{selectedNameLead} </span>}<em>{selectedNameAccent}</em></h1><div className="selected-base-price"><span>БАЗОВАЯ ЦЕНА</span><b>{formatPrice(basePrice)}</b></div></div>
        <div className="selected-price-line"><strong>{formatPrice(selectedDrink.price)}</strong><span className={positive ? 'selected-change positive' : 'selected-change negative'}>{positive ? '▲' : '▼'} {positive ? '+' : '−'}{Math.abs(selectedDrink.change).toFixed(1)}%</span></div>
        <div className="market-detail-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={selectedHistory} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}><defs><linearGradient id="detailFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chartColor} stopOpacity=".5" /><stop offset="100%" stopColor={chartColor} stopOpacity="0" /></linearGradient></defs><CartesianGrid stroke="#343434" vertical={true} /><XAxis dataKey="time" tick={{ fill: '#d4d4d4', fontSize: 12 }} axisLine={{ stroke: '#767676' }} tickLine={{ stroke: '#767676' }} /><YAxis domain={['auto', 'auto']} tick={{ fill: '#d4d4d4', fontSize: 12 }} tickFormatter={(value) => Math.round(value).toLocaleString('ru-RU')} axisLine={{ stroke: '#767676' }} tickLine={false} width={62} /><Tooltip formatter={(value) => [formatPrice(value), 'Цена']} contentStyle={{ background: '#050606', border: `1px solid ${chartColor}`, color: '#fff' }} /><Area type="monotone" dataKey="value" stroke={chartColor} fill="url(#detailFill)" strokeWidth={4} activeDot={{ r: 5, fill: chartColor }} /></AreaChart></ResponsiveContainer></div>
      </article>
    </section>
    <DisplayBottomTicker drinks={drinks} speed={tickerSettings?.speed} />
  </main>;
}

function Admin({ drinks, events, simulate, setPrice, marketHistory, tickerSettings, updateTickerSettings, resetChartHistories }) {
  const [tab, setTab] = useState('overview'); const [query, setQuery] = useState(''); const [sidebar, setSidebar] = useState(false); const [editingId, setEditingId] = useState(null); const [draftPrice, setDraftPrice] = useState('');
  const filtered = drinks.filter((drink) => `${drink.name} ${drink.symbol} ${drink.category}`.toLowerCase().includes(query.toLowerCase()));
  const openTab = (nextTab) => { setTab(nextTab); setSidebar(false); };
  const beginEdit = (drink) => { setEditingId(drink.id); setDraftPrice(String(Math.round(drink.price))); };
  const savePrice = (drinkId) => { if (Number(draftPrice) > 0) setPrice(drinkId, draftPrice); setEditingId(null); };
  const currentBarIndex = marketHistory[marketHistory.length - 1]?.value ?? calculateBarPriceIndex(drinks);
  const barIndexChange = currentBarIndex - 100;
  const tabLabel = tab === 'overview' ? 'ОБЗОР' : tab === 'catalog' ? 'КАТАЛОГ' : 'БЕГУЩАЯ СТРОКА';
  const tabTitle = tab === 'overview' ? 'Добрый вечер, Алекс.' : tab === 'catalog' ? 'Каталог напитков' : 'Экран тикера';
  const tabDescription = tab === 'overview' ? 'Вот что сейчас происходит на вашем рынке.' : tab === 'catalog' ? 'Управляйте инструментами и симулируйте продажи.' : 'Настройте второй монитор без изменения логики цен.';
  return <div className="admin-page"><Header admin /><aside className={sidebar ? 'sidebar open' : 'sidebar'}><div className="sidebar-title">ОПЕРАЦИИ</div><button className={tab === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => openTab('overview')}><BarChart3 size={17} /> Обзор</button><button className={tab === 'catalog' ? 'nav-item active' : 'nav-item'} onClick={() => openTab('catalog')}><ShoppingBag size={17} /> Каталог напитков</button><button className="nav-item"><Bell size={17} /> Уведомления <span className="nav-badge">3</span></button><div className="sidebar-title second">СИСТЕМА</div><button className={tab === 'ticker' ? 'nav-item active' : 'nav-item'} onClick={() => openTab('ticker')}><Settings2 size={17} /> Бегущая строка</button><button className="nav-item"><CircleHelp size={17} /> Помощь</button><div className="sidebar-bottom"><div className="connection"><span className="pulse" /><div><b>Симулятор подключён</b><small>WebSocket · 42 мс</small></div></div><a href="/display" className="display-link"><Maximize2 size={15} /> Открыть табло</a></div></aside>{sidebar && <button className="sidebar-scrim" onClick={() => setSidebar(false)} aria-label="Закрыть навигацию" />}
    <main className="admin-main">
      <div className="admin-mobilebar"><button onClick={() => setSidebar(true)}><Menu /></button><span>ОПЕРАЦИИ</span></div>
      <div className="admin-heading"><div><span className="eyebrow">ПУЛЬТ УПРАВЛЕНИЯ / {tabLabel}</span><h1>{tabTitle}</h1><p>{tabDescription}</p></div><div className="date-chip"><Clock3 size={15} /> Среда, 12 ноября 2026</div></div>
      {tab === 'overview' ? <>
        <div className="kpi-grid"><div className="kpi-card"><span>ИНДЕКС ЦЕН БАРА · BMI</span><b>{currentBarIndex.toFixed(2)}</b><Change value={barIndexChange} /><small>база 100 · не прибыль</small></div><div className="kpi-card"><span>ВАЛОВАЯ ВЫРУЧКА</span><b>3 842 000 ₸</b><Change value={8.6} /><small>сегодня · 186 сделок</small></div><div className="kpi-card"><span>СРЕДНЯЯ ЦЕНА</span><b>{formatPrice(drinks.reduce((sum, drink) => sum + drink.price, 0) / drinks.length)}</b><Change value={1.2} /><small>по 8 инструментам</small></div><div className="kpi-card"><span>АКТИВНЫЕ АЛЕРТЫ</span><b className="alert-number">03</b><span className="alert-tag">НУЖНА ПРОВЕРКА</span><small>2 цены · 1 остаток</small></div></div>
        <div className="admin-grid"><div className="panel admin-chart"><div className="panel-heading"><div><span className="eyebrow">ДИНАМИКА BMI</span><h2>Индекс цен бара</h2></div><div className="chart-actions"><div className="range-tabs"><button className="selected">3Ч</button><button>6Ч</button><button>1Д</button></div><button className="reset-chart-button" onClick={resetChartHistories} title="Очистить графики и обнулить проценты изменения всех напитков"><RotateCcw size={13} /> Сбросить графики и %</button></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={marketHistory}><defs><linearGradient id="adminFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d8a756" stopOpacity=".34" /><stop offset="100%" stopColor="#d8a756" stopOpacity="0" /></linearGradient></defs><CartesianGrid stroke="#2b2d2d" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="time" tick={{ fill: '#858b8d', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis domain={['auto', 'auto']} tick={{ fill: '#858b8d', fontSize: 10 }} axisLine={false} tickLine={false} width={42} /><Area type="monotone" dataKey="value" stroke="#d8a756" fill="url(#adminFill)" strokeWidth={2.5} /></AreaChart></ResponsiveContainer></div></div>
        <div className="panel simulator-panel"><div className="panel-heading"><div><span className="eyebrow">ДЕМО-ИНСТРУМЕНТ</span><h2>Симулировать продажу</h2></div><Activity size={18} /></div><p>Запустите сделку и увидьте изменение цены в реальном времени.</p><label>ВЫБЕРИТЕ НАПИТОК<select id="sim-drink">{drinks.map((drink) => <option key={drink.id} value={drink.id}>{drink.name} · {formatPrice(drink.price)}</option>)}</select></label><label>КОЛИЧЕСТВО<div className="quantity"><button>-</button><b>1</b><button>+</button></div></label><button className="simulate-button" onClick={() => simulate(document.getElementById('sim-drink').value, 1)}><Flame size={16} /> Провести тестовую продажу</button></div></div>
        <div className="panel table-panel"><div className="table-heading"><div><span className="eyebrow">ИНСТРУМЕНТЫ</span><h2>Рынок напитков</h2></div><div className="table-actions"><div className="search"><Search size={15} /><input placeholder="Поиск напитка" value={query} onChange={(e) => setQuery(e.target.value)} /></div><button className="filter-button">Все категории <ChevronDown size={14} /></button></div></div><div className="drink-table"><div className="table-row table-header"><span>ИНСТРУМЕНТ</span><span>ТЕКУЩАЯ ЦЕНА</span><span>ИЗМЕНЕНИЕ</span><span>ОБЪЁМ</span><span>СТАТУС</span></div>{filtered.map((drink) => <div className="table-row" key={drink.id}><span className="instrument"><i style={{ background: drink.color }} /> <b>{drink.name}</b><small>{drink.symbol}</small></span><span>{formatPrice(drink.price)}</span><Change value={drink.change} /><span>{drink.volume}</span><span className="status"><i /> Торгуется</span></div>)}</div></div>
      </> : tab === 'catalog' ? <div className="panel table-panel catalog-panel"><div className="table-heading"><div><span className="eyebrow">КАТАЛОГ</span><h2>Инструменты</h2></div><div className="search"><Search size={15} /><input placeholder="Поиск напитка" value={query} onChange={(e) => setQuery(e.target.value)} /></div></div><div className="drink-table">{filtered.map((drink) => <div className="table-row" key={drink.id}><span className="instrument"><i style={{ background: drink.color }} /> <b>{drink.name}</b><small>{drink.symbol} · {drink.category}</small></span><span>{formatPrice(drink.price)}</span><Change value={drink.change} />{editingId === drink.id ? <span className="price-editor"><input type="number" min="3000" step="50" value={draftPrice} onChange={(e) => setDraftPrice(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && savePrice(drink.id)} /><button className="mini-trade save-price" onClick={() => savePrice(drink.id)}>Сохранить</button></span> : <span className="catalog-actions"><button className="mini-trade" onClick={() => beginEdit(drink)}>Изменить цену</button><button className="mini-trade test-sale" onClick={() => simulate(drink.id, 1)}>Тестовая продажа</button></span>}</div>)}</div></div> : <TickerSettingsPanel drinks={drinks} tickerSettings={tickerSettings} updateTickerSettings={updateTickerSettings} />}
    </main>
  </div>;
}

function App() {
  const market = useMarket();
  if (location.pathname.startsWith('/ticker')) return <PublicTicker {...market} />;
  if (location.pathname.startsWith('/admin')) return <Admin {...market} />;
  return <Display {...market} />;
}
createRoot(document.getElementById('root')).render(<App />);
