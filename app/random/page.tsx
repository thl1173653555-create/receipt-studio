"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import restaurantMenu from "../../data/menu.json";
import supermarketMenu from "../../data/supermarket-menu.json";
import russianMenu from "../../data/russian-menu.json";
import grillMenu from "../../data/grill-menu.json";
import kioskMenu from "../../data/kiosk-menu.json";
import {
  DEFAULT_WEIGHTS,
  MAIN_CATEGORIES,
  composeMeal,
  fmtMoney,
  randomDate,
  randomTime,
} from "../random-meal.mjs";

type ReceiptScenario = "restaurant" | "supermarket" | "russian-restaurant" | "grill" | "kiosk";
type PaperFormat = "58" | "80";

type OrderItem = {
  id: string;
  name: string;
  price: number;
  category: string;
  code?: string;
  vat?: number;
  qty: number;
};

type ReceiptData = {
  storeName: string;
  company: string;
  address: string;
  cashier: string;
  date: string;
  time: string;
  saleNumber: string;
  payment: string;
  items: OrderItem[];
  register?: string;
  shift?: string;
  taxSystem?: string;
  fiscalDocument?: string;
  fiscalSign?: string;
  fn?: string;
  rn?: string;
  inn?: string;
  ofd?: string;
  place?: string;
  savings?: number;
  table?: string;
  server?: string;
};

type SavedReceipt = {
  id: string;
  savedAt: string;
  scenario: ReceiptScenario;
  format: PaperFormat;
  font: string;
  kind: "manual" | "random";
  data: ReceiptData;
  qr: Record<PaperFormat, { x: number; y: number; size: number }>;
};

const HISTORY_KEY = "beihai-receipt-history-v1";

const MENUS: Record<ReceiptScenario, OrderItem[]> = {
  restaurant: restaurantMenu as OrderItem[],
  supermarket: supermarketMenu as OrderItem[],
  "russian-restaurant": russianMenu as OrderItem[],
  grill: grillMenu as OrderItem[],
  kiosk: kioskMenu as OrderItem[],
};

const DEFAULT_QR: Record<PaperFormat, { x: number; y: number; size: number }> = {
  "58": { x: 27, y: -1, size: 19 },
  "80": { x: 52, y: -1, size: 22 },
};

const PAYMENTS = ["БАНК. КАРТОЙ", "БЕЗНАЛИЧНЫМИ", "НАЛИЧНЫМИ"];

const STORE_TEMPLATES: Record<
  ReceiptScenario,
  Omit<ReceiptData, "date" | "time" | "saleNumber" | "payment" | "items">
> = {
  restaurant: {
    storeName: 'РЕСТОРАН КИТАЙСКОЙ КУХНИ "БЭЙ ХАЙ"',
    company: 'Общество с ограниченной ответственностью "ВЕРЕСК"',
    address:
      "25 — Приморский край, г. Большой Камень, 692806, г. Большой Камень, ул. Приморского Комсомола, д. 2",
    cashier: "МАЛИНОВСКИЙ Р. В. ДИРЕКТОР",
    rn: "0008659688010745",
    inn: "2503001332",
    fn: "7380440903084287",
    fiscalDocument: "4648",
    fiscalSign: "2443271199",
  },
  supermarket: {
    storeName: 'ООО "САПФИР"',
    company: 'ООО "САПФИР"',
    address: "692802, Г. БОЛЬШОЙ КАМЕНЬ, УЛ. АЛЕЯ ТРУДА, Д. 8",
    cashier: "АВТОМАТ 20-6 КСО",
    register: "0006.01",
    shift: "0230",
    taxSystem: "ОСН",
    fiscalDocument: "54784",
    fiscalSign: "0082339468",
    fn: "7384440901113190",
    rn: "0008454318052675",
    inn: "2503029218",
    ofd: "CASH-NNT.KONTUR.RU",
    place: 'МАГАЗИН "РЕМИ"',
  },
  "russian-restaurant": {
    storeName: 'РЕСТОРАН РУССКОЙ КУХНИ "САМОВАР"',
    company: 'ООО "САМОВАР"',
    address: "692806, Г. БОЛЬШОЙ КАМЕНЬ, УЛ. ПРИМОРСКОГО КОМСОМОЛА, Д. 5",
    cashier: "СМИРНОВА Е. А.",
    rn: "0008659688010746",
    inn: "2503001333",
    fn: "7380440903084288",
    fiscalDocument: "5031",
    fiscalSign: "2443271200",
    taxSystem: "ОСН",
    table: "СТОЛИК 5",
    server: "ИВАН",
  },
  grill: {
    storeName: 'ШАШЛЫЧНАЯ "ЖАР-ПТИЦА"',
    company: "ИП ГОРБУНОВ А. С.",
    address: "692806, Г. БОЛЬШОЙ КАМЕНЬ, УЛ. МАСЛОЗАВОДСКАЯ, Д. 12",
    cashier: "ШАШЛЫЧНИК ГОРБУНОВ А. С.",
    rn: "0008659688010747",
    inn: "2503001334",
    fn: "7380440903084289",
    fiscalDocument: "6112",
    fiscalSign: "2443271201",
    taxSystem: "УСН ДОХОД",
  },
  kiosk: {
    storeName: 'ПРОДУКТЫ 24 ЧАСА "У ДОМА"',
    company: "ИП ПЕТРОВА М. И.",
    address: "692806, Г. БОЛЬШОЙ КАМЕНЬ, УЛ. ЛЕНИНА, Д. 3, ЛАРЁК 2",
    cashier: "ПЕТРОВА М. И.",
    register: "0006.02",
    shift: "0812",
    taxSystem: "УСН ДОХОД",
    fiscalDocument: "90214",
    fiscalSign: "0082339470",
    fn: "7384440901113191",
    rn: "0008454318052676",
    inn: "2503029219",
    ofd: "CASH-NNT.KONTUR.RU",
    place: 'ЛАРЁК "У ДОМА"',
  },
};

const SCENARIO_LABELS: Record<ReceiptScenario, string> = {
  restaurant: "餐厅",
  supermarket: "超市",
  "russian-restaurant": "俄餐厅",
  grill: "烧烤厅",
  kiosk: "小卖部",
};

const SCENARIO_OPTIONS: { value: ReceiptScenario; icon: string; label: string; sub: string }[] = [
  { value: "restaurant", icon: "餐", label: "餐厅", sub: "Китайская кухня" },
  { value: "supermarket", icon: "超", label: "超市", sub: "Магазин / продукты" },
  { value: "russian-restaurant", icon: "俄", label: "俄餐厅", sub: "Русский ресторан" },
  { value: "grill", icon: "烤", label: "烧烤厅", sub: "Шашлычная" },
  { value: "kiosk", icon: "店", label: "小卖部", sub: "Киоск 24 часа" },
];

const GRILL_WAITERS = ["ИВАН", "АННА", "ОЛЬГА", "ДМИТРИЙ", "ЕЛЕНА", "СЕРГЕЙ"];

function formatInputDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function RandomReceiptPage() {
  const [scenario, setScenario] = useState<ReceiptScenario>("restaurant");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [timeFrom, setTimeFrom] = useState("09:00");
  const [timeTo, setTimeTo] = useState("21:00");
  const [amountMin, setAmountMin] = useState("1000");
  const [amountMax, setAmountMax] = useState("1500");
  const [countInput, setCountInput] = useState("2");
  const [saleMin, setSaleMin] = useState("10");
  const [saleMax, setSaleMax] = useState("30");
  const [weights, setWeights] = useState<Record<string, number>>(() => ({
    ...DEFAULT_WEIGHTS.restaurant,
  }));
  const [results, setResults] = useState<SavedReceipt[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setDateFrom("2026-07-04");
    setDateTo("2026-08-06");
  }, []);

  useEffect(() => {
    setWeights({ ...DEFAULT_WEIGHTS[scenario] });
    setResults([]);
    setError("");
  }, [scenario]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const scenarioLabel = SCENARIO_LABELS[scenario];
  const format: PaperFormat = scenario === "supermarket" ? "80" : "58";
  const categories = Object.keys(DEFAULT_WEIGHTS[scenario]);

  function setWeight(category: string, rawValue: string) {
    const value = Math.max(0, Math.min(10, Math.floor(Number(rawValue) || 0)));
    setWeights((current) => ({ ...current, [category]: value }));
  }

  function buildEntry(meal: { items: OrderItem[]; total: number }, index: number): SavedReceipt {
    const today = formatInputDate(new Date());
    const template = STORE_TEMPLATES[scenario];
    const saleNumber = String(
      Math.floor(Math.random() * (Number(saleMax) - Number(saleMin) + 1)) + Number(saleMin),
    ).padStart(2, "0");
    const data: ReceiptData = {
      ...template,
      date: randomDate(dateFrom || today, dateTo || today),
      time: randomTime(timeFrom, timeTo),
      saleNumber,
      payment: PAYMENTS[Math.floor(Math.random() * PAYMENTS.length)],
      items: meal.items.map((item) => ({ ...item, id: makeId() })),
      savings:
        (scenario === "supermarket" || scenario === "kiosk") && Math.random() < 0.5
          ? Math.floor(Math.random() * 56) + 5
          : 0,
      ...(scenario === "russian-restaurant"
        ? {
            table: `СТОЛИК ${Math.floor(Math.random() * 12) + 1}`,
            server: GRILL_WAITERS[Math.floor(Math.random() * GRILL_WAITERS.length)],
          }
        : {}),
    };
    return {
      id: makeId(),
      savedAt: new Date().toISOString(),
      scenario,
      format,
      font: "ticket-mono",
      kind: "random",
      data,
      qr: DEFAULT_QR,
    };
  }

  function generate() {
    const min = Number(amountMin);
    const max = Number(amountMax);
    const count = Math.min(Math.max(1, Math.floor(Number(countInput) || 1)), 10);
    const saleLow = Math.floor(Number(saleMin) || 10);
    const saleHigh = Math.floor(Number(saleMax) || 30);

    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) {
      setError("金额范围无效:请确认下限 ≤ 上限,且都是正数。");
      setResults([]);
      return;
    }
    if (saleLow < 0 || saleHigh < saleLow) {
      setError("销售编号范围无效:请确认下限 ≤ 上限,且不小于 0。");
      setResults([]);
      return;
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setError("日期段无效:开始日期晚于结束日期。");
      setResults([]);
      return;
    }

    const drafts: SavedReceipt[] = [];
    for (let i = 0; i < count; i++) {
      const meal = composeMeal(MENUS[scenario], { min, max, weights, scenario });
      if (!meal.ok) {
        setError(`第 ${i + 1} 张生成失败:${meal.error}`);
        setResults([]);
        return;
      }
      drafts.push(buildEntry(meal, i));
    }

    setResults(drafts);
    setError("");
    setNotice(`已随机生成 ${count} 张${scenarioLabel}小票,确认无误后点击「保存」写入本机历史`);
  }

  function saveGenerated() {
    if (results.length === 0) {
      setNotice("还没有生成结果,请先点击「随机生成」");
      return;
    }
    const nextHistory = [...results, ...readLocal<SavedReceipt[]>(HISTORY_KEY, [])].slice(0, 50);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    setNotice(`已保存 ${results.length} 张到本机历史「随机生成」,共 ${nextHistory.length} 条`);
  }

  const mainHint = MAIN_CATEGORIES[scenario].join(" / ");

  return (
    <main className="app-shell random-page">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">БХ</div>
          <div>
            <p className="eyebrow">RECEIPT STUDIO / RANDOMIZER</p>
            <h1>随机小票生成器</h1>
          </div>
        </div>
        <div className="top-actions">
          <Link className="button button-ghost" href="/">← 返回小票生成器</Link>
        </div>
      </header>

      <div className="page-intro">
        <div>
          <p className="eyebrow accent">СЛУЧАЙНЫЙ ЧЕК / RANDOM</p>
          <h2>输入一个预算,<br /><em>配出一顿合理的饭。</em></h2>
          <p className="intro-copy">
            在日期、时间、金额范围内随机生成小票,自动配餐(主菜优先、饮料限量)、
            随机销售编号,并一键保存到本机历史的「随机生成」子菜单。
          </p>
        </div>
        <div className="intro-note">
          <span className="note-number">🎲</span>
          <span>按饮食逻辑配餐<br />主菜:{mainHint}</span>
        </div>
      </div>

      <div className="workspace random-workspace">
        <section className="editor-column">
          <div className="control-card scenario-card">
            <div className="card-heading">
              <div><span className="section-index">01</span><h3>业务场景</h3></div>
              <span className="muted">决定菜单与配餐规则</span>
            </div>
            <div className="scenario-options">
              {SCENARIO_OPTIONS.map((option) => (
                <label className={`scenario-option ${scenario === option.value ? "selected" : ""}`} key={option.value}>
                  <input type="radio" name="random-scenario" checked={scenario === option.value} onChange={() => setScenario(option.value)} />
                  <span className="scenario-icon">{option.icon}</span>
                  <span><strong>{option.label}</strong><small>{option.sub}</small></span>
                </label>
              ))}
            </div>
          </div>

          <div className="control-card">
            <div className="card-heading">
              <div><span className="section-index">02</span><h3>随机范围</h3></div>
              <span className="muted">日期 / 时间 / 金额 / 编号</span>
            </div>
            <div className="range-grid">
              <label className="field-label">日期段 <span>开始 — 结束</span>
                <span className="range-inputs">
                  <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                  <span className="range-sep">至</span>
                  <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                </span>
              </label>
              <label className="field-label">时间段 <span>营业时间</span>
                <span className="range-inputs">
                  <input type="time" value={timeFrom} onChange={(event) => setTimeFrom(event.target.value)} />
                  <span className="range-sep">至</span>
                  <input type="time" value={timeTo} onChange={(event) => setTimeTo(event.target.value)} />
                </span>
              </label>
              <label className="field-label">金额段(₽) <span>配餐预算</span>
                <span className="range-inputs">
                  <input type="number" min="0" step="0.01" value={amountMin} onChange={(event) => setAmountMin(event.target.value)} />
                  <span className="range-sep">至</span>
                  <input type="number" min="0" step="0.01" value={amountMax} onChange={(event) => setAmountMax(event.target.value)} />
                </span>
              </label>
            </div>
            <div className="field-grid three random-number-grid">
              <label className="field-label">份数 <span>生成几张</span>
                <input type="number" min="1" max="10" value={countInput} onChange={(event) => setCountInput(event.target.value)} />
              </label>
              <label className="field-label">销售编号下限 <span>默认 10</span>
                <input type="number" min="0" max="999" value={saleMin} onChange={(event) => setSaleMin(event.target.value)} />
              </label>
              <label className="field-label">销售编号上限 <span>默认 30</span>
                <input type="number" min="0" max="999" value={saleMax} onChange={(event) => setSaleMax(event.target.value)} />
              </label>
            </div>
            <p className="qr-note">销售编号在上下限之间随机(默认两位 10–30);日期、时间、支付方式也随机。</p>
          </div>

          <div className="control-card">
            <div className="card-heading">
              <div><span className="section-index">03</span><h3>类别优先级</h3></div>
              <button type="button" className="button button-clear" onClick={() => setWeights({ ...DEFAULT_WEIGHTS[scenario] })}>重置默认</button>
            </div>
            <div className="weight-grid">
              {categories.map((category) => (
                <label className="weight-row" key={category}>
                  <span>{category}</span>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={weights[category] ?? 0}
                    onChange={(event) => setWeight(category, event.target.value)}
                    aria-label={`${category} 权重`}
                  />
                </label>
              ))}
            </div>
            <p className="qr-note">
              权重 0 = 不选该类别。主菜类别({mainHint})保证每张至少一道;饮料/零食/甜品等小食类
              每类最多 1 种、合计最多 2 种 —— 一单不能全是零食饮料。
            </p>
          </div>

          <div className="random-actions">
            <button type="button" className="button button-primary button-big" onClick={generate}>
              🎲 随机生成 {Math.min(Math.max(1, Math.floor(Number(countInput) || 1)), 10)} 张
            </button>
            <button type="button" className="button button-outline button-big" onClick={saveGenerated} disabled={results.length === 0}>
              💾 保存{results.length > 0 ? ` ${results.length} 张` : ""}
            </button>
          </div>

          {error && <div className="error-banner" role="alert">⚠️ {error}</div>}

          <section className="control-card history-card">
            <div className="card-heading">
              <div><span className="section-index">04</span><h3>生成结果</h3></div>
              <span className="muted">生成后点「保存」写入历史 · 最多 50 张</span>
            </div>
            {results.length === 0 ? (
              <div className="empty-history">
                设置好范围后点击上方按钮,生成的{scenarioLabel}小票会出现在这里。
              </div>
            ) : (
              <div className="result-list">
                {results.map((entry, index) => (
                  <article className="random-result-card" key={entry.id}>
                    <header className="result-head">
                      <strong>第 {index + 1} 张</strong>
                      <span className="muted">
                        {entry.data.date} {entry.data.time} · № {entry.data.saleNumber} ·{" "}
                        {entry.data.payment} · {entry.data.items.length} 种商品
                      </span>
                    </header>
                    <div className="meal-table">
                      <div className="meal-table-head"><span>名称</span><span>数量</span><span>单价</span><span>金额</span></div>
                      {entry.data.items.map((item) => (
                        <div className="meal-table-row" key={item.id}>
                          <span className="meal-name">{item.name}</span>
                          <span>×{item.qty}</span>
                          <span>{fmtMoney(item.price)} ₽</span>
                          <strong>{fmtMoney(item.qty * item.price)} ₽</strong>
                        </div>
                      ))}
                    </div>
                    <footer className="result-foot">
                      <span>合计</span>
                      <strong>{fmtMoney(entry.data.items.reduce((sum, item) => sum + item.qty * item.price, 0))} ₽</strong>
                    </footer>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>

        <aside className="random-side">
          <div className="control-card">
            <div className="card-heading">
              <div><span className="section-index">i</span><h3>怎么用</h3></div>
            </div>
            <ol className="random-steps">
              <li>选好场景(餐厅 / 超市 / 俄餐厅 / 烧烤厅 / 小卖部),填日期、时间、金额范围。</li>
              <li>调整类别优先级:主菜类别权重高一些,零食饮料权重低一些。</li>
              <li>点「随机生成」,系统按预算自动配餐;满意后点「保存」写入本机历史。</li>
              <li>回到 <Link href="/">小票生成器</Link>,在历史的「随机生成」里打开、编辑、打印。</li>
            </ol>
            <p className="qr-note">
              金额段配不出时(比如上限低于最便宜的主菜),会给出提示词并说明原因和建议。
            </p>
          </div>
        </aside>
      </div>

      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
