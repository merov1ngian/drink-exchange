import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, Bell, ChevronDown, CircleHelp, Clock3, Flame, Maximize2, Menu, Radio, Search, Settings2, ShoppingBag, Wifi, X } from 'lucide-react';
import './styles.css';

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
];
const formatPrice = (value) => `${Math.round(Number(value)).toLocaleString('ru-RU')} ₸`;
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
  const [marketHistory, setMarketHistory] = useState(chartData);
  const [priceHistories, setPriceHistories] = useState(() => buildPriceHistories(seedDrinks));
  const previousAverageRef = useRef(null);
  const marketHistoryRef = useRef(chartData);
  const priceHistoriesRef = useRef(buildPriceHistories(seedDrinks));
  const [events, setEvents] = useState([
    { time: '20:36:12', buyer: 'Стол 12', drink: 'Негрони', quantity: 2, amount: 18500 },
    { time: '20:35:48', buyer: 'Бар', drink: 'Острая Маргарита', quantity: 1, amount: 8000 },
    { time: '20:34:22', buyer: 'Гость', drink: 'Эспрессо Мартини', quantity: 2, amount: 17500 },
    { time: '20:33:51', buyer: 'Стол 07', drink: 'Олд Фэшн', quantity: 1, amount: 19000 }
  ]);
  const socketRef = useRef(null);
  useEffect(() => {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${location.hostname}:3001/ws`);
    socketRef.current = socket;
    socket.onmessage = (message) => {
      const data = JSON.parse(message.data);
      if (data.type === 'snapshot') {
        setDrinks(data.drinks);
        const histories = buildPriceHistories(data.drinks);
        priceHistoriesRef.current = histories;
        setPriceHistories(histories);
        previousAverageRef.current = data.drinks.reduce((sum, drink) => sum + Number(drink.rawPrice ?? drink.price), 0) / data.drinks.length;
      }
      if (data.type === 'market_update') {
        setDrinks(data.drinks);
        const pointTime = new Date(data.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const nextPriceHistories = Object.fromEntries(data.drinks.map((drink) => {
          const current = priceHistoriesRef.current[drink.id] || buildPriceHistory(drink);
          return [drink.id, [...current.slice(-20), { time: pointTime, value: drink.price }]];
        }));
        priceHistoriesRef.current = nextPriceHistories;
        setPriceHistories(nextPriceHistories);
        const average = data.drinks.reduce((sum, drink) => sum + Number(drink.rawPrice ?? drink.price), 0) / data.drinks.length;
        const previousAverage = previousAverageRef.current || average;
        const previousValue = marketHistoryRef.current[marketHistoryRef.current.length - 1]?.value || 84.6;
        const nextValue = Number((previousValue * (average / previousAverage)).toFixed(2));
        previousAverageRef.current = average;
        const nextHistory = [...marketHistoryRef.current.slice(-20), { time: new Date(data.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), value: nextValue }];
        marketHistoryRef.current = nextHistory;
        setMarketHistory(nextHistory);
        const drink = data.drinks.find((item) => item.id === data.trade?.drinkId);
        if (drink) setEvents((current) => [{ time: new Date(data.trade.timestamp).toLocaleTimeString('ru-RU'), buyer: data.trade.buyer, drink: drink.name, quantity: data.trade.quantity, amount: data.trade.price }, ...current].slice(0, 8));
      }
    };
    return () => socket.close();
  }, []);
  const simulate = (drinkId, quantity = 1) => socketRef.current?.send(JSON.stringify({ type: 'simulate', drinkId, quantity }));
  const setPrice = (drinkId, price) => socketRef.current?.send(JSON.stringify({ type: 'set_price', drinkId, price: Number(price) }));
  return { drinks, events, marketHistory, priceHistories, simulate, setPrice };
}

function Header({ admin = false }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(id); }, []);
  return <header className="topbar">
    <div className="brand"><div className="brand-mark">◆</div><div><div className="brand-name">DRINK <span>EXCHANGE</span></div><div className="brand-sub">ЖИВАЯ АНАЛИТИКА РЫНКА</div></div></div>
    <div className="market-state"><span className="pulse" /> <span>РЫНОК ОТКРЫТ</span><span className="state-divider" /><Clock3 size={14} /> <strong>{time.toLocaleTimeString('ru-RU')}</strong><span className="tz">GMT+5</span></div>
    {admin ? <div className="header-actions"><div className="user-chip">A <span>Администратор</span><ChevronDown size={14} /></div></div> : <div className="live-pill"><Wifi size={13} /> ОНЛАЙН</div>}
  </header>;
}

function Change({ value }) { return <span className={value >= 0 ? 'change up' : 'change down'}>{value >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}{Math.abs(value).toFixed(1)}%</span>; }

function Sparkline({ positive = true }) { return <svg className="sparkline" viewBox="0 0 100 30" preserveAspectRatio="none"><polyline fill="none" stroke={positive ? '#66d69a' : '#e46d70'} strokeWidth="2" points={positive ? '0,25 12,22 23,24 34,15 46,18 58,10 68,13 79,6 90,9 100,2' : '0,6 12,9 23,8 34,15 46,12 58,18 68,14 79,22 90,18 100,27'} /></svg>; }

function Display({ drinks, events, priceHistories }) {
  const [selected, setSelected] = useState('NEGR');
  const selectedDrink = drinks.find((drink) => drink.id === selected) || drinks[0];
  const sorted = useMemo(() => [...drinks].sort((a, b) => b.change - a.change), [drinks]);
  const selectedHistory = priceHistories[selectedDrink.id] || buildPriceHistory(selectedDrink);
  const latestPrice = selectedHistory[selectedHistory.length - 1]?.value ?? selectedDrink.price;
  const previousPrice = selectedHistory[selectedHistory.length - 2]?.value ?? latestPrice;
  const chartChange = previousPrice ? ((latestPrice / previousPrice) - 1) * 100 : 0;
  const chartIsUp = latestPrice >= previousPrice;
  const chartColor = chartIsUp ? '#66d69a' : '#e46d70';
  return <div className="display-page"><Header /><div className="display-content">
    <section className="display-hero"><div><div className="eyebrow"><Activity size={14} /> ЖИВОЕ ТАБЛО <span>•</span> СЕССИЯ 06</div><h1>Ночь<br /><em>движется.</em></h1><p>Цены меняются вместе с залом. Успейте взять любимый напиток, пока он в топе.</p></div><div className="hero-stats"><div><span>ОБЪЁМ СЕССИИ</span><b>186</b><small>НАПИТКОВ ПРОДАНО</small></div><div><span>ИНДЕКС БАРА</span><b className="gold">+2.84%</b><small>К ОТКРЫТИЮ</small></div></div></section>
    <div className="ticker-strip">{sorted.slice(0, 6).map((drink) => <button className={`ticker ${selected === drink.id ? 'active' : ''}`} key={drink.id} onClick={() => setSelected(drink.id)}><span className="ticker-symbol">{drink.symbol}</span><strong>{formatPrice(drink.price)}</strong><Change value={drink.change} /></button>)}</div>
    <section className="market-grid"><div className="panel chart-panel"><div className="panel-heading"><div><span className="eyebrow">ДИНАМИКА ЦЕНЫ · {selectedDrink.symbol}</span><h2>{selectedDrink.name}</h2></div><div className="chart-value"><b>{formatPrice(latestPrice)}</b><Change value={chartChange} /></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={selectedHistory}><defs><linearGradient id="marketFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chartColor} stopOpacity=".32" /><stop offset="100%" stopColor={chartColor} stopOpacity="0" /></linearGradient></defs><CartesianGrid stroke="#283035" strokeDasharray="2 5" vertical={false} /><XAxis dataKey="time" tick={{ fill: '#778188', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis domain={['auto', 'auto']} tick={{ fill: '#778188', fontSize: 10 }} tickFormatter={(value) => `${Math.round(value / 100) / 10}k`} axisLine={false} tickLine={false} width={42} /><Tooltip formatter={(value) => [formatPrice(value), 'Цена']} contentStyle={{ background: '#111619', border: '1px solid #374047', borderRadius: 4, color: '#f5f2ea' }} /><Area type="monotone" dataKey="value" stroke={chartColor} fill="url(#marketFill)" strokeWidth={2} activeDot={{ r: 4, fill: chartColor }} /></AreaChart></ResponsiveContainer></div><div className="chart-caption"><span><i className={`dot ${chartIsUp ? 'gold-dot' : 'red-dot'}`} /> ИСТОРИЯ ЦЕНЫ · {selectedDrink.symbol}</span><span>ПОСЛЕДНИЕ 3 ЧАСА</span></div></div>
      <div className="panel spotlight-panel"><div className="panel-heading"><div><span className="eyebrow">СЕЙЧАС В ТОРГАХ</span><h2>Лидеры движения</h2></div><Flame className="flame" size={20} /></div><div className="mover-list">{sorted.slice(0, 5).map((drink, index) => <button className={`mover-row ${selected === drink.id ? 'selected' : ''}`} key={drink.id} onClick={() => setSelected(drink.id)}><span className="rank">0{index + 1}</span><span className="mover-name"><b>{drink.name}</b><small>{drink.symbol} · {drink.category.toUpperCase()}</small></span><Sparkline positive={drink.change >= 0} /><span className="mover-price">{formatPrice(drink.price)}<Change value={drink.change} /></span></button>)}</div><div className="panel-foot"><span>Нажмите на напиток для деталей</span><Maximize2 size={14} /></div></div>
    </section>
    <section className="lower-grid"><div className="panel order-panel"><div className="panel-heading"><div><span className="eyebrow">ВЫБРАННЫЙ НАПИТОК</span><h2>{selectedDrink.name} <span className="instrument-symbol">{selectedDrink.symbol}</span></h2></div><div className="big-price">{formatPrice(selectedDrink.price)}<Change value={selectedDrink.change} /></div></div><div className="price-line"><span className="price-label">ПОСЛЕДНЯЯ СДЕЛКА</span><span>{formatPrice(selectedDrink.price)}</span><span className="price-label">МАКС. ЗА СЕССИЮ</span><span>{formatPrice(selectedDrink.price * 1.08)}</span><span className="price-label">ОБЪЁМ</span><span>{selectedDrink.volume}</span></div></div><div className="panel tape-panel"><div className="panel-heading"><div><span className="eyebrow">ЛЕНТА СДЕЛОК</span><h2>Последние сделки</h2></div><Radio size={17} className="radio-icon" /></div><div className="tape-list">{events.slice(0, 4).map((event, i) => <div className="tape-row" key={`${event.time}-${i}`}><span>{event.time}</span><b>{event.drink}</b><span>{event.quantity}x</span><strong>{formatPrice(event.amount)}</strong></div>)}</div></div></section>
    <footer className="display-footer"><span>DRINK EXCHANGE <b>·</b> ЦЕНЫ ОБНОВЛЯЮТСЯ КАЖДЫЕ 5 СЕК</span><span><span className="pulse" /> ВСЕ СИСТЕМЫ РАБОТАЮТ</span></footer>
  </div></div>;
}

function Admin({ drinks, events, simulate, setPrice, marketHistory }) {
  const [tab, setTab] = useState('overview'); const [query, setQuery] = useState(''); const [sidebar, setSidebar] = useState(false); const [editingId, setEditingId] = useState(null); const [draftPrice, setDraftPrice] = useState('');
  const filtered = drinks.filter((drink) => `${drink.name} ${drink.symbol} ${drink.category}`.toLowerCase().includes(query.toLowerCase()));
  const beginEdit = (drink) => { setEditingId(drink.id); setDraftPrice(String(Math.round(drink.price))); };
  const savePrice = (drinkId) => { if (Number(draftPrice) > 0) setPrice(drinkId, draftPrice); setEditingId(null); };
  return <div className="admin-page"><Header admin /><aside className={sidebar ? 'sidebar open' : 'sidebar'}><div className="sidebar-title">ОПЕРАЦИИ</div><button className={tab === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('overview')}><BarChart3 size={17} /> Обзор</button><button className={tab === 'catalog' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('catalog')}><ShoppingBag size={17} /> Каталог напитков</button><button className="nav-item"><Bell size={17} /> Уведомления <span className="nav-badge">3</span></button><div className="sidebar-title second">СИСТЕМА</div><button className="nav-item"><Settings2 size={17} /> Настройки</button><button className="nav-item"><CircleHelp size={17} /> Помощь</button><div className="sidebar-bottom"><div className="connection"><span className="pulse" /><div><b>Симулятор подключён</b><small>WebSocket · 42 мс</small></div></div><a href="/display" className="display-link"><Maximize2 size={15} /> Открыть табло</a></div></aside>{sidebar && <button className="sidebar-scrim" onClick={() => setSidebar(false)} aria-label="Закрыть навигацию" />}
    <main className="admin-main">
      <div className="admin-mobilebar"><button onClick={() => setSidebar(true)}><Menu /></button><span>ОПЕРАЦИИ</span></div>
      <div className="admin-heading"><div><span className="eyebrow">ПУЛЬТ УПРАВЛЕНИЯ / {tab === 'overview' ? 'ОБЗОР' : 'КАТАЛОГ'}</span><h1>{tab === 'overview' ? 'Добрый вечер, Алекс.' : 'Каталог напитков'}</h1><p>{tab === 'overview' ? 'Вот что сейчас происходит на вашем рынке.' : 'Управляйте инструментами и симулируйте продажи.'}</p></div><div className="date-chip"><Clock3 size={15} /> Среда, 12 ноября 2026</div></div>
      {tab === 'overview' ? <>
        <div className="kpi-grid"><div className="kpi-card"><span>ИНДЕКС БАРА</span><b>{marketHistory[marketHistory.length - 1]?.value.toFixed(1) || '84.6'}</b><Change value={2.84} /><small>текущее значение</small></div><div className="kpi-card"><span>ВАЛОВАЯ ВЫРУЧКА</span><b>3 842 000 ₸</b><Change value={8.6} /><small>сегодня · 186 сделок</small></div><div className="kpi-card"><span>СРЕДНЯЯ ЦЕНА</span><b>{formatPrice(drinks.reduce((sum, drink) => sum + drink.price, 0) / drinks.length)}</b><Change value={1.2} /><small>по 8 инструментам</small></div><div className="kpi-card"><span>АКТИВНЫЕ АЛЕРТЫ</span><b className="alert-number">03</b><span className="alert-tag">НУЖНА ПРОВЕРКА</span><small>2 цены · 1 остаток</small></div></div>
        <div className="admin-grid"><div className="panel admin-chart"><div className="panel-heading"><div><span className="eyebrow">ДИНАМИКА</span><h2>Активность рынка</h2></div><div className="range-tabs"><button className="selected">3Ч</button><button>6Ч</button><button>1Д</button></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={marketHistory}><defs><linearGradient id="adminFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#67d69a" stopOpacity=".28" /><stop offset="100%" stopColor="#67d69a" stopOpacity="0" /></linearGradient></defs><CartesianGrid stroke="#253039" strokeDasharray="2 5" vertical={false} /><XAxis dataKey="time" tick={{ fill: '#73808a', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis domain={['auto', 'auto']} tick={{ fill: '#73808a', fontSize: 10 }} axisLine={false} tickLine={false} width={30} /><Area type="monotone" dataKey="value" stroke="#67d69a" fill="url(#adminFill)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div></div>
        <div className="panel simulator-panel"><div className="panel-heading"><div><span className="eyebrow">ДЕМО-ИНСТРУМЕНТ</span><h2>Симулировать продажу</h2></div><Activity size={18} /></div><p>Запустите сделку и увидьте изменение цены в реальном времени.</p><label>ВЫБЕРИТЕ НАПИТОК<select id="sim-drink">{drinks.map((drink) => <option key={drink.id} value={drink.id}>{drink.name} · {formatPrice(drink.price)}</option>)}</select></label><label>КОЛИЧЕСТВО<div className="quantity"><button>-</button><b>1</b><button>+</button></div></label><button className="simulate-button" onClick={() => simulate(document.getElementById('sim-drink').value, 1)}><Flame size={16} /> Провести тестовую продажу</button></div></div>
        <div className="panel table-panel"><div className="table-heading"><div><span className="eyebrow">ИНСТРУМЕНТЫ</span><h2>Рынок напитков</h2></div><div className="table-actions"><div className="search"><Search size={15} /><input placeholder="Поиск напитка" value={query} onChange={(e) => setQuery(e.target.value)} /></div><button className="filter-button">Все категории <ChevronDown size={14} /></button></div></div><div className="drink-table"><div className="table-row table-header"><span>ИНСТРУМЕНТ</span><span>ТЕКУЩАЯ ЦЕНА</span><span>ИЗМЕНЕНИЕ</span><span>ОБЪЁМ</span><span>СТАТУС</span></div>{filtered.map((drink) => <div className="table-row" key={drink.id}><span className="instrument"><i style={{ background: drink.color }} /> <b>{drink.name}</b><small>{drink.symbol}</small></span><span>{formatPrice(drink.price)}</span><Change value={drink.change} /><span>{drink.volume}</span><span className="status"><i /> Торгуется</span></div>)}</div></div>
      </> : <div className="panel table-panel catalog-panel"><div className="table-heading"><div><span className="eyebrow">КАТАЛОГ</span><h2>Инструменты</h2></div><div className="search"><Search size={15} /><input placeholder="Поиск напитка" value={query} onChange={(e) => setQuery(e.target.value)} /></div></div><div className="drink-table">{filtered.map((drink) => <div className="table-row" key={drink.id}><span className="instrument"><i style={{ background: drink.color }} /> <b>{drink.name}</b><small>{drink.symbol} · {drink.category}</small></span><span>{formatPrice(drink.price)}</span><Change value={drink.change} />{editingId === drink.id ? <span className="price-editor"><input type="number" min="3000" step="50" value={draftPrice} onChange={(e) => setDraftPrice(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && savePrice(drink.id)} /><button className="mini-trade save-price" onClick={() => savePrice(drink.id)}>Сохранить</button></span> : <span className="catalog-actions"><button className="mini-trade" onClick={() => beginEdit(drink)}>Изменить цену</button><button className="mini-trade test-sale" onClick={() => simulate(drink.id, 1)}>Тестовая продажа</button></span>}</div>)}</div></div>}
    </main>
  </div>;
}

function App() { const market = useMarket(); return location.pathname.startsWith('/admin') ? <Admin {...market} /> : <Display {...market} />; }
createRoot(document.getElementById('root')).render(<App />);
