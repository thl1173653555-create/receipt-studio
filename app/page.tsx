"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import menuFile from "../data/menu.json";
import supermarketMenuFile from "../data/supermarket-menu.json";
import { buildPrintPageRule } from "./print-page.mjs";

type PaperFormat = "58" | "80";
type ReceiptScenario = "restaurant" | "supermarket";
type ReceiptFont = "ticket-mono" | "courier-new" | "consolas" | "arial";
type MenuCategory =
  | "冷菜" | "热菜" | "主食" | "饮品" | "酒水" | "甜品" | "其他"
  | "Молочные продукты" | "Хлеб и выпечка" | "Бакалея" | "Сладости" | "Снеки"
  | "Напитки" | "Консервы и соусы" | "Заморозка" | "Для дома" | "Красота и уход" | "Товары для животных";
type MenuFilter = "全部" | MenuCategory;

type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: MenuCategory;
  code?: string;
  vat?: number;
};

type OrderItem = MenuItem & {
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
};

type QrPosition = {
  x: number;
  y: number;
  size: number;
};

type SavedReceipt = {
  id: string;
  savedAt: string;
  scenario?: ReceiptScenario;
  format: PaperFormat;
  font?: ReceiptFont;
  data: ReceiptData;
  qr: Record<PaperFormat, QrPosition>;
};

const HISTORY_KEY = "beihai-receipt-history-v1";
const MENU_KEYS: Record<ReceiptScenario, string> = {
  restaurant: "beihai-receipt-menu-v1",
  supermarket: "beihai-supermarket-menu-v1",
};
const MENU_CATEGORIES_BY_SCENARIO: Record<ReceiptScenario, MenuFilter[]> = {
  restaurant: ["全部", "冷菜", "热菜", "主食", "饮品", "酒水", "甜品", "其他"],
  supermarket: ["全部", "Молочные продукты", "Хлеб и выпечка", "Бакалея", "Сладости", "Снеки", "Напитки", "Консервы и соусы", "Заморозка", "Для дома", "Красота и уход", "Товары для животных"],
};

const PAPER: Record<PaperFormat, { label: string; paper: number; content: number }> = {
  "58": { label: "58mm / 48mm打印宽度", paper: 58, content: 48 },
  "80": { label: "80mm / 80mm打印宽度", paper: 80, content: 80 },
};

const RECEIPT_FONTS: Record<ReceiptFont, { label: string; detail: string }> = {
  "ticket-mono": { label: "Liberation Mono", detail: "热敏小票默认" },
  "courier-new": { label: "Courier New", detail: "经典俄式 POS（加粗）" },
  consolas: { label: "Consolas", detail: "清晰等宽" },
  arial: { label: "Arial", detail: "无衬线俄文" },
};

const DEFAULT_MENUS: Record<ReceiptScenario, MenuItem[]> = {
  restaurant: menuFile as MenuItem[],
  supermarket: supermarketMenuFile as MenuItem[],
};
const DEFAULT_MENU = DEFAULT_MENUS.restaurant;

const DEFAULT_RECEIPT: ReceiptData = {
  storeName: 'РЕСТОРАН КИТАЙСКОЙ КУХНИ "БЭЙ ХАЙ"',
  company: 'Общество с ограниченной ответственностью "ВЕРЕСК"',
  address: "25 — Приморский край, г. Большой Камень, 692806, г. Большой Камень, ул. Приморского Комсомола, д. 2",
  cashier: "МАЛИНОВСКИЙ Р. В. ДИРЕКТОР",
  date: "2026-07-19",
  time: "21:09",
  saleNumber: "7056",
  payment: "БАНК. КАРТОЙ",
  rn: "0008659688010745",
  inn: "2503001332",
  fn: "7380440903084287",
  fiscalDocument: "4648",
  fiscalSign: "2443271199",
  items: DEFAULT_MENU.slice(0, 3).map((item) => ({ ...item, qty: 1 })),
};

const DEFAULT_SUPERMARKET_RECEIPT: ReceiptData = {
  storeName: 'ООО "САПФИР"',
  company: 'ООО "САПФИР"',
  address: "692802, Г. БОЛЬШОЙ КАМЕНЬ, УЛ. АЛЕЯ ТРУДА, Д. 8",
  cashier: "АВТОМАТ 20-6 КСО",
  date: "2026-07-19",
  time: "21:24",
  saleNumber: "224",
  payment: "БЕЗНАЛИЧНЫМИ",
  savings: 30.09,
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
  items: DEFAULT_MENUS.supermarket.slice(0, 7).map((item) => ({ ...item, qty: 1 })),
};

const DEFAULT_QR: Record<PaperFormat, QrPosition> = {
  "58": { x: 27, y: -1, size: 19 },
  "80": { x: 52, y: -1, size: 22 },
};

const DEMO_TAX_FIELDS = [
  ["ЗН ККТ", "00106102179719"],
  ["РН ККТ", "0008659688010745"],
  ["ИНН", "2503001332"],
  ["ФН", "7380440903084287"],
  ["ФД", "4648"],
  ["ФП", "2443271199"],
];

function formatMoney(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}.${month}.${year.slice(-2)}` : value;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeMenu(items: MenuItem[], defaults: MenuItem[]) {
  return items.map((item) => {
    const fallback = defaults.find((defaultItem) => defaultItem.id === item.id);
    return { ...item, category: item.category ?? fallback?.category ?? "其他" };
  });
}

function mergeMenu(items: MenuItem[], defaults: MenuItem[]) {
  const normalized = normalizeMenu(items, defaults);
  const savedById = new Map(normalized.map((item) => [item.id, item]));
  const builtIn = defaults.map((item) => savedById.get(item.id) ?? item);
  const custom = normalized.filter((item) => !defaults.some((defaultItem) => defaultItem.id === item.id));
  return [...builtIn, ...custom];
}

function receiptTemplateForScenario(scenario: ReceiptScenario) {
  return scenario === "supermarket" ? DEFAULT_SUPERMARKET_RECEIPT : DEFAULT_RECEIPT;
}

export default function Home() {
  const [scenario, setScenario] = useState<ReceiptScenario>("restaurant");
  const [format, setFormat] = useState<PaperFormat>("58");
  const [receiptFont, setReceiptFont] = useState<ReceiptFont>("ticket-mono");
  const [receipt, setReceipt] = useState<ReceiptData>(DEFAULT_RECEIPT);
  const [qrPositions, setQrPositions] = useState(DEFAULT_QR);
  const [menu, setMenu] = useState<MenuItem[]>(DEFAULT_MENU);
  const [history, setHistory] = useState<SavedReceipt[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [newMenuName, setNewMenuName] = useState("");
  const [newMenuPrice, setNewMenuPrice] = useState("0");
  const [newMenuCategory, setNewMenuCategory] = useState<MenuCategory>("其他");
  const [menuQuery, setMenuQuery] = useState("");
  const [menuCategory, setMenuCategory] = useState<MenuFilter>("全部");
  const [notice, setNotice] = useState("");

  const total = useMemo(
    () => receipt.items.reduce((sum, item) => sum + item.qty * item.price, 0),
    [receipt.items],
  );

  const qrPayload = useMemo(() => {
    const timestamp = `${receipt.date.replace(/-/g, "")}T${receipt.time.replace(":", "")}`;
    const fn = receipt.fn ?? DEMO_TAX_FIELDS[3][1];
    const fiscalDocument = receipt.fiscalDocument ?? DEMO_TAX_FIELDS[4][1];
    const fiscalSign = receipt.fiscalSign ?? DEMO_TAX_FIELDS[5][1];

    return [
      `t=${timestamp}`,
      `s=${formatMoney(total)}`,
      `fn=${fn}`,
      `i=${fiscalDocument}`,
      `fp=${fiscalSign}`,
      "n=1",
    ].join("&");
  }, [receipt, total]);

  useEffect(() => {
    setHistory(readLocal<SavedReceipt[]>(HISTORY_KEY, []));
    setMenu(mergeMenu(readLocal<MenuItem[]>(MENU_KEYS[scenario], []), DEFAULT_MENUS[scenario]));
    setMenuCategory("鍏ㄩ儴");
    setNewMenuCategory(MENU_CATEGORIES_BY_SCENARIO[scenario][1] as MenuCategory);
  }, [scenario]);

  useEffect(() => {
    QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: "L",
      margin: 3,
      width: 1024,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then(setQrImage)
      .catch(() => setQrImage(""));
  }, [qrPayload]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const currentPaper = PAPER[format];
  const qr = qrPositions[format];
  const currentDefaultMenu = DEFAULT_MENUS[scenario];
  const menuCategories = MENU_CATEGORIES_BY_SCENARIO[scenario];
  const filteredMenu = useMemo(() => {
    const query = menuQuery.trim().toLocaleLowerCase();
    return menu.filter((item) => {
      const matchesQuery = !query || item.name.toLocaleLowerCase().includes(query);
      const matchesCategory = menuCategory === "全部" || item.category === menuCategory;
      return matchesQuery && matchesCategory;
    });
  }, [menu, menuCategory, menuQuery]);

  const vatTotal = (rate: number) => receipt.items.reduce((sum, item) => {
    if ((item.vat ?? 22) !== rate) return sum;
    const itemVat = (item.qty * item.price * rate) / (100 + rate);
    return sum + Number(itemVat.toFixed(2));
  }, 0);

  function updateReceipt<K extends keyof ReceiptData>(field: K, value: ReceiptData[K]) {
    setReceipt((current) => ({ ...current, [field]: value }));
    setActiveId(null);
  }

  function updateQr(field: keyof QrPosition, rawValue: string) {
    const parsedValue = Number(rawValue);
    const value = Number.isFinite(parsedValue) ? parsedValue : 0;
    const minimum = field === "y" ? -10 : field === "size" ? 14 : 0;
    const maximum = field === "x" ? currentPaper.content - qr.size : field === "size" ? currentPaper.content - Math.max(qr.x, 0) : 120;
    const nextValue = Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
    setQrPositions((current) => ({
      ...current,
      [format]: { ...current[format], [field]: nextValue },
    }));
    setActiveId(null);
  }

  function addToOrder(item: MenuItem) {
    setReceipt((current) => ({
      ...current,
      items: [...current.items, { ...item, id: makeId(), qty: 1 }],
    }));
    setActiveId(null);
    setNotice("已加入本次小票");
  }

  function updateOrderItem(id: string, field: "name" | "qty" | "price", value: string) {
    setReceipt((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== id) return item;
        if (field === "name") return { ...item, name: value };
        const numeric = Math.max(0, Number(value) || 0);
        return { ...item, [field]: numeric };
      }),
    }));
    setActiveId(null);
  }

  function removeOrderItem(id: string) {
    setReceipt((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== id),
    }));
    setActiveId(null);
  }

  function clearOrder() {
    setReceipt((current) => ({ ...current, items: [] }));
    setActiveId(null);
    setNotice("已清空本单");
  }

  function addCustomMenuItem(saveToMenu: boolean) {
    const name = newMenuName.trim();
    const price = Math.max(0, Number(newMenuPrice) || 0);
    if (!name) {
      setNotice("请先填写菜品名称");
      return;
    }
    const item: MenuItem = {
      id: makeId(),
      name,
      price,
      category: newMenuCategory,
      ...(scenario === "supermarket" ? { code: "000000", vat: 22 } : {}),
    };
    if (saveToMenu) {
      const nextMenu = [...menu, item];
      setMenu(nextMenu);
      window.localStorage.setItem(MENU_KEYS[scenario], JSON.stringify(nextMenu));
      setNotice("已保存到常用菜单并加入本单");
    } else {
      setNotice("已加入本单");
    }
    addToOrder(item);
    setNewMenuName("");
    setNewMenuPrice("0");
    setNewMenuCategory(MENU_CATEGORIES_BY_SCENARIO[scenario][1] as MenuCategory);
  }

  function deleteMenuItem(id: string) {
    const nextMenu = menu.filter((item) => item.id !== id);
    setMenu(nextMenu);
    window.localStorage.setItem(MENU_KEYS[scenario], JSON.stringify(nextMenu));
    setNotice("已从常用菜单移除");
  }

  function saveReceipt() {
    const entry: SavedReceipt = {
      id: activeId ?? makeId(),
      savedAt: new Date().toISOString(),
      scenario,
      format,
      font: receiptFont,
      data: receipt,
      qr: qrPositions,
    };
    const nextHistory = [entry, ...history.filter((item) => item.id !== entry.id)].slice(0, 50);
    setHistory(nextHistory);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    setActiveId(entry.id);
    setNotice("小票已保存到本机历史");
  }

  function loadReceipt(entry: SavedReceipt) {
    setScenario(entry.scenario ?? "restaurant");
    setReceipt(entry.data);
    setFormat(entry.format);
    setReceiptFont(entry.font ?? "ticket-mono");
    setQrPositions(entry.qr);
    setActiveId(entry.id);
    setNotice("已打开历史小票");
  }

  function deleteHistory(id: string) {
    const nextHistory = history.filter((item) => item.id !== id);
    setHistory(nextHistory);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    if (activeId === id) setActiveId(null);
    setNotice("历史小票已删除");
  }

  function startNewReceipt() {
    const template = receiptTemplateForScenario(scenario);
    setReceipt({ ...template, items: template.items.map((item) => ({ ...item, id: makeId() })) });
    setFormat("58");
    setQrPositions(DEFAULT_QR);
    setActiveId(null);
    setNotice("已新建小票");
  }

  function switchScenario(nextScenario: ReceiptScenario) {
    const template = receiptTemplateForScenario(nextScenario);
    setScenario(nextScenario);
    setReceipt({ ...template, items: template.items.map((item) => ({ ...item, id: makeId() })) });
    setMenu(mergeMenu(readLocal<MenuItem[]>(MENU_KEYS[nextScenario], []), DEFAULT_MENUS[nextScenario]));
    setMenuCategory("全部");
    setMenuQuery("");
    setNewMenuCategory(MENU_CATEGORIES_BY_SCENARIO[nextScenario][1] as MenuCategory);
    setQrPositions(DEFAULT_QR);
    setActiveId(null);
    setNotice(nextScenario === "supermarket" ? "已切换到超市场景" : "已切换到餐厅场景");
  }

  async function printReceipt() {
    const printArea = document.getElementById("print-area");
    if (!printArea) return;

    await document.fonts.ready;

    const measureHost = document.createElement("div");
    measureHost.className = "print-measure-host";
    measureHost.style.setProperty("--paper-width", `${currentPaper.paper}mm`);

    const printCopy = printArea.cloneNode(true) as HTMLElement;
    printCopy.removeAttribute("id");
    measureHost.appendChild(printCopy);
    document.body.appendChild(measureHost);

    const images = Array.from(printCopy.querySelectorAll("img"));
    await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const page = buildPrintPageRule(
      currentPaper.paper,
      printCopy.getBoundingClientRect().height,
    );
    measureHost.remove();

    document.getElementById("receipt-print-page-size")?.remove();
    const pageStyle = document.createElement("style");
    pageStyle.id = "receipt-print-page-size";
    pageStyle.textContent = page.css;
    document.head.appendChild(pageStyle);
    document.documentElement.dataset.receiptPrinting = format;

    const cleanup = () => {
      pageStyle.remove();
      delete document.documentElement.dataset.receiptPrinting;
    };
    window.addEventListener("afterprint", cleanup, { once: true });

    requestAnimationFrame(() => window.print());
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">БХ</div>
          <div>
            <p className="eyebrow">RECEIPT STUDIO / БЭЙ ХАЙ</p>
            <h1>餐馆小票生成器</h1>
          </div>
        </div>
        <div className="top-actions">
          <span className="status-pill"><span className="status-dot" /> 非税务二维码模式</span>
          <button className="button button-ghost" onClick={startNewReceipt}>新建小票</button>
          <button className="button button-primary" onClick={saveReceipt}>保存小票</button>
        </div>
      </header>

      <div className="page-intro">
        <div>
          <p className="eyebrow accent">收银工作台 / CASH DESK</p>
          <h2>把一张订单，整理成<br /><em>可以直接打印的小票。</em></h2>
          <p className="intro-copy">选择纸张、点选菜单、核对金额。二维码只包含本次消费的可读信息，不连接俄罗斯税务系统。</p>
        </div>
        <div className="intro-note">
          <span className="note-number">01</span>
          <span>当前编辑<br />{activeId ? "历史小票" : "新建草稿"}</span>
        </div>
      </div>

      <div className="workspace">
        <section className="editor-column" aria-label="小票编辑区">
          <div className="control-card scenario-card">
            <div className="card-heading">
              <div><span className="section-index">01</span><h3>业务场景</h3></div>
              <span className="muted">选择打印模板</span>
            </div>
            <div className="scenario-options">
              <label className={`scenario-option ${scenario === "restaurant" ? "selected" : ""}`}>
                <input type="radio" name="receipt-scenario" checked={scenario === "restaurant"} onChange={() => switchScenario("restaurant")} />
                <span className="scenario-icon">餐</span>
                <span><strong>餐厅</strong><small>Русский ресторан</small></span>
              </label>
              <label className={`scenario-option ${scenario === "supermarket" ? "selected" : ""}`}>
                <input type="radio" name="receipt-scenario" checked={scenario === "supermarket"} onChange={() => switchScenario("supermarket")} />
                <span className="scenario-icon">超</span>
                <span><strong>超市</strong><small>Магазин / продукты</small></span>
              </label>
            </div>
          </div>

          <div className="control-card">
            <div className="card-heading">
              <div><span className="section-index">02</span><h3>纸张规格</h3></div>
              <span className="muted">打印设置</span>
            </div>
            <div className="format-options">
              {(Object.keys(PAPER) as PaperFormat[]).map((key) => (
                <label className={`format-option ${format === key ? "selected" : ""}`} key={key}>
                  <input type="radio" name="paper-format" checked={format === key} onChange={() => setFormat(key)} />
                  <span className="format-preview"><span className={`format-roll format-roll-${key}`} /></span>
                  <span><strong>{PAPER[key].label.split("/")[0]}</strong><small>{PAPER[key].label.split("/")[1]}</small></span>
                  <span className="checkmark">✓</span>
                </label>
              ))}
            </div>
            <label className="field-label receipt-font-select">小票字体 <span>预览与打印同步</span>
              <select name="receipt-font" value={receiptFont} onChange={(event) => { setReceiptFont(event.target.value as ReceiptFont); setActiveId(null); }}>
                {(Object.keys(RECEIPT_FONTS) as ReceiptFont[]).map((key) => <option key={key} value={key}>{RECEIPT_FONTS[key].label} · {RECEIPT_FONTS[key].detail}</option>)}
              </select>
            </label>
          </div>

          <div className="control-card">
            <div className="card-heading">
              <div><span className="section-index">03</span><h3>店铺与订单</h3></div>
              <span className="muted">俄文打印内容</span>
            </div>
            <label className="field-label">店名 <span>可修改</span>
              <input value={receipt.storeName} onChange={(event) => updateReceipt("storeName", event.target.value)} />
            </label>
            <div className="field-grid three">
              <label className="field-label">日期<input type="date" value={receipt.date} onChange={(event) => updateReceipt("date", event.target.value)} /></label>
              <label className="field-label">时间<input type="time" value={receipt.time} onChange={(event) => updateReceipt("time", event.target.value)} /></label>
              <label className="field-label">销售编号<input value={receipt.saleNumber} onChange={(event) => updateReceipt("saleNumber", event.target.value)} /></label>
            </div>
            <label className="field-label">支付方式
              <select value={receipt.payment} onChange={(event) => updateReceipt("payment", event.target.value)}>
                <option>БАНК. КАРТОЙ</option>
                <option>БЕЗНАЛИЧНЫМИ</option>
                <option>НАЛИЧНЫМИ</option>
              </select>
            </label>
            <label className="field-label">节省金额（卢布）
              <input type="number" min="0" step="0.01" value={receipt.savings ?? 0} onChange={(event) => updateReceipt("savings", Math.max(0, Number(event.target.value) || 0))} />
            </label>
            <div className="field-grid three">
              <label className="field-label">税控号 ФН<input value={receipt.fn ?? ""} onChange={(event) => updateReceipt("fn", event.target.value)} /></label>
              <label className="field-label">单据号 ФД<input value={receipt.fiscalDocument ?? ""} onChange={(event) => updateReceipt("fiscalDocument", event.target.value)} /></label>
              <label className="field-label">特征码 ФП<input value={receipt.fiscalSign ?? ""} onChange={(event) => updateReceipt("fiscalSign", event.target.value)} /></label>
            </div>
          </div>

          <div className="control-card menu-card">
            <div className="card-heading">
              <div><span className="section-index">04</span><h3>选择菜单</h3></div>
              <span className="muted">{filteredMenu.length} 项可选</span>
            </div>
            <div className="menu-tools">
              <input aria-label="搜索菜单" placeholder="搜索俄文菜名" value={menuQuery} onChange={(event) => setMenuQuery(event.target.value)} />
              <select aria-label="菜单分类" value={menuCategory} onChange={(event) => setMenuCategory(event.target.value as MenuFilter)}>
                {menuCategories.map((category) => <option key={category} value={category}>{category === "全部" ? "全部分类" : category}</option>)}
              </select>
            </div>
            <div className="menu-filter-tabs" aria-label="菜单分类快捷筛选">
              {menuCategories.map((category) => <button type="button" className={menuCategory === category ? "active" : ""} key={category} aria-pressed={menuCategory === category} onClick={() => setMenuCategory(category)}>{category}</button>)}
            </div>
            <div className="menu-list menu-list-scroll">
              {filteredMenu.length === 0 && <div className="empty-order">没有找到匹配的菜品。</div>}
              {filteredMenu.map((item, index) => (
                <div className="menu-row" key={item.id}>
                  <div className="menu-number">{String(index + 1).padStart(2, "0")}</div>
                  <div className="menu-copy"><strong>{scenario === "supermarket" && item.code ? `${item.code} · ` : ""}{item.name}</strong><span><b>{item.category}</b> · {formatMoney(item.price)} ₽{scenario === "supermarket" ? ` · НДС ${item.vat ?? 22}%` : ""}</span></div>
                  <button className="icon-button add-button" onClick={() => addToOrder(item)} aria-label={`加入${item.name}`}>+</button>
                  {!currentDefaultMenu.some((defaultItem) => defaultItem.id === item.id) && <button className="icon-button delete-button" onClick={() => deleteMenuItem(item.id)} aria-label={`删除${item.name}`}>×</button>}
                </div>
              ))}
            </div>
            <div className="custom-menu-form">
              <div className="small-label">新增菜品 / 可保存到常用菜单</div>
              <div className="field-grid custom-grid">
                <input placeholder="俄文菜品名称" value={newMenuName} onChange={(event) => setNewMenuName(event.target.value)} />
                <input type="number" min="0" step="0.01" placeholder="单价" value={newMenuPrice} onChange={(event) => setNewMenuPrice(event.target.value)} />
                <select aria-label="新增菜品分类" value={newMenuCategory} onChange={(event) => setNewMenuCategory(event.target.value as MenuCategory)}>
                  {menuCategories.filter((category): category is MenuCategory => category !== "全部").map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </div>
              <div className="custom-actions">
                <button className="button button-soft" onClick={() => addCustomMenuItem(false)}>仅加入本单</button>
                <button className="button button-outline" onClick={() => addCustomMenuItem(true)}>保存并加入</button>
              </div>
            </div>
          </div>

          <div className="control-card">
            <div className="card-heading">
              <div><span className="section-index">05</span><h3>本次点单</h3></div>
              <div className="order-actions"><span className="total-chip">{formatMoney(total)} ₽</span><button className="button button-clear" onClick={clearOrder} disabled={receipt.items.length === 0}>清空本单</button></div>
            </div>
            <div className="order-list">
              {receipt.items.length === 0 && <div className="empty-order">还没有商品，从上面的菜单中点击 + 加入。</div>}
              {receipt.items.map((item, index) => (
                <div className="order-row" key={item.id}>
                  <div className="order-row-top"><span className="order-index">{String(index + 1).padStart(2, "0")}</span><input aria-label="商品名称" value={item.name} onChange={(event) => updateOrderItem(item.id, "name", event.target.value)} /><button className="remove-line" onClick={() => removeOrderItem(item.id)} aria-label="删除商品">×</button></div>
                  <div className="order-row-bottom">
                    <label>数量<input type="number" min="0" step="1" value={item.qty} onChange={(event) => updateOrderItem(item.id, "qty", event.target.value)} /></label>
                    <label>单价<input type="number" min="0" step="0.01" value={item.price} onChange={(event) => updateOrderItem(item.id, "price", event.target.value)} /></label>
                    <strong>{formatMoney(item.qty * item.price)} ₽</strong>
                  </div>
                </div>
              ))}
            </div>
            <div className="total-bar"><span>订单总计</span><strong>{formatMoney(total)} ₽</strong></div>
          </div>

          <div className="control-card">
            <div className="card-heading">
              <div><span className="section-index">06</span><h3>二维码位置</h3></div>
              <span className="muted">与底部演示信息并排 · mm / {format}mm</span>
            </div>
            <div className="qr-position-grid">
              <label className="field-label">X 左右<input type="number" min="0" max={currentPaper.content} value={qr.x} onChange={(event) => updateQr("x", event.target.value)} /></label>
              <label className="field-label">Y 上下<input type="number" min="-10" max="120" value={qr.y} onChange={(event) => updateQr("y", event.target.value)} /></label>
              <label className="field-label">尺寸<input type="number" min="14" max={currentPaper.content} value={qr.size} onChange={(event) => updateQr("size", event.target.value)} /></label>
            </div>
            <div className="qr-payload-box"><div><span className="small-label">扫码后显示的文本</span><span className="plain-badge">非税务演示</span></div><p className="qr-note">扫码可看到与本单同步的日期、金额和税控字段，格式与真实收据一致；不连接、不模拟俄罗斯税务系统。</p><textarea readOnly value={qrPayload} /></div>
          </div>

          <div className="control-card history-card">
            <div className="card-heading">
              <div><span className="section-index">07</span><h3>本机历史</h3></div>
              <span className="muted">最多保存50张</span>
            </div>
            {history.length === 0 ? <div className="empty-history">保存后，小票会出现在这里。</div> : <div className="history-list">
              {history.slice(0, 8).map((entry) => <div className={`history-row ${activeId === entry.id ? "current" : ""}`} key={entry.id}>
                <button className="history-open" onClick={() => loadReceipt(entry)}><strong>{entry.data.storeName}</strong><span>{formatDate(entry.data.date)} · {entry.data.saleNumber} · {formatMoney(entry.data.items.reduce((sum, item) => sum + item.qty * item.price, 0))} ₽</span></button>
                <button className="history-delete" onClick={() => deleteHistory(entry.id)} aria-label="删除历史">×</button>
              </div>)}
            </div>}
          </div>
        </section>

        <section className="preview-column" aria-label="小票预览区">
          <div className="preview-header"><div><span className="eyebrow accent">LIVE PREVIEW</span><h3>打印预览</h3></div><button className="button button-print" type="button" onClick={printReceipt}><span>↗</span> 打印小票</button></div>
          <div className="preview-stage">
            <div className={`receipt-page page--${format}`} style={{ ["--paper-width" as string]: `${currentPaper.paper}mm` } as React.CSSProperties}>
              <div id="print-area" className={`receipt-paper paper--${format} receipt--${scenario} font--${receiptFont}`} style={{ ["--content-width" as string]: `${currentPaper.content}mm`, ["--qr-x" as string]: `${qr.x}mm`, ["--qr-y" as string]: `${qr.y}mm`, ["--qr-size" as string]: `${qr.size}mm` } as React.CSSProperties}>
                {scenario === "restaurant" ? (
                  <>
                    <div className="receipt-top-line">— — — — — — — — — — — — — — — — — — — — — — — — — —</div>
                    <div className="receipt-store">{receipt.storeName}</div>
                    <div className="receipt-rule" />
                    <div className="receipt-subtitle">КАССОВЫЙ ЧЕК</div>
                    <div className="receipt-rule" />
                    <div className="receipt-items">
                      {receipt.items.map((item) => <div className="receipt-item" key={item.id}>
                        <div className="receipt-item-name">{item.name}</div>
                        <div className="receipt-item-price"><span>{formatMoney(item.price)}*{item.qty} шт.</span><strong>={formatMoney(item.qty * item.price)}</strong></div>
                        <div className="receipt-tax">НДС не облагается</div>
                      </div>)}
                    </div>
                    <div className="receipt-rule" />
                    <div className="receipt-summary">
                      <div className="receipt-row"><span>Номер продажи</span><strong>{receipt.saleNumber}</strong></div>
                      <div className="receipt-row receipt-grand-total"><span>ИТОГ</span><strong>={formatMoney(total)}</strong></div>
                      <div className="receipt-row"><span>СУММА БЕЗ НДС</span><strong>={formatMoney(total)}</strong></div>
                      <div className="receipt-row"><span>БЕЗНАЛИЧНЫМИ</span><strong>={formatMoney(total)}</strong></div>
                      <div className="receipt-row"><span>*{receipt.payment}</span><strong>={formatMoney(total)}</strong></div>
                    </div>
                    <div className="receipt-rule" />
                    <div className="receipt-company"><div>КАССИР <span>{receipt.cashier}</span></div><div>{receipt.company}</div><div>{receipt.address}</div><div>МЕСТО РАСЧЕТОВ <span>Ресторан &quot;Бэйхай&quot;</span></div></div>
                    <div className="receipt-bottom-cluster">
                      <div className="receipt-tax-fields"><div><span>{DEMO_TAX_FIELDS[0][0]}</span><strong>{DEMO_TAX_FIELDS[0][1]}</strong></div><div><span>{formatDate(receipt.date)} {receipt.time}</span><strong /></div><div><span>{DEMO_TAX_FIELDS[1][0]}</span><strong>{receipt.rn ?? DEMO_TAX_FIELDS[1][1]}</strong></div><div><span>{DEMO_TAX_FIELDS[2][0]}</span><strong>{receipt.inn ?? DEMO_TAX_FIELDS[2][1]}</strong></div><div><span>{DEMO_TAX_FIELDS[3][0]}</span><strong>{receipt.fn ?? DEMO_TAX_FIELDS[3][1]}</strong></div><div><span>{DEMO_TAX_FIELDS[4][0]}</span><strong>{receipt.fiscalDocument ?? DEMO_TAX_FIELDS[4][1]}</strong></div><div><span>{DEMO_TAX_FIELDS[5][0]}</span><strong>{receipt.fiscalSign ?? DEMO_TAX_FIELDS[5][1]}</strong></div><div className="receipt-income">ПРИХОД</div></div>
                      <div className="receipt-qr-slot"><div className="receipt-qr" aria-label="非税务二维码">{qrImage ? <img src={qrImage} alt="本次小票非税务演示二维码" /> : <span>QR</span>}</div></div>
                    </div>
                    <div className="receipt-bottom-line">— — — — — — — — — — — — — — — — — — — — — — — — — —</div>
                  </>
                ) : (
                  <>
                    <div className="receipt-top-line">— — — — — — — — — — — — — — — — — — — — — — — — — —</div>
                    <div className="receipt-store">{receipt.storeName}</div>
                    <div className="market-address">{receipt.address}</div>
                    <div className="receipt-subtitle">КАССОВЫЙ ЧЕК <span>{receipt.saleNumber}</span> (ПРИХОД)</div>
                    <div className="receipt-rule" />
                    <div className="market-table-head"><span>КОД ТОВАРА</span><span>ТОВАРЫ</span><span>ЦЕНА</span><span>КОЛ-ВО</span><span>НДС</span><span>СТОИМОСТЬ</span></div>
                    <div className="receipt-rule" />
                    <div className="market-items">
                      {receipt.items.map((item) => <div className="market-item" key={item.id}>
                        <span>{item.code ?? "000000"}</span><span>{item.name}</span><span>{formatMoney(item.price)}</span><span>*{item.qty}</span><span>{item.vat ?? 22}%</span><strong>={formatMoney(item.qty * item.price)}</strong>
                      </div>)}
                    </div>
                    <div className="receipt-rule" />
                    <div className="market-summary">
                      <div className="receipt-row"><span>ИТОГ</span><strong>={formatMoney(total)}</strong></div>
                      <div className="receipt-row"><span>{receipt.payment}</span><strong>={formatMoney(total)}</strong></div>
                      <div className="market-vat-row"><span>СУММА НДС 10%</span><strong>={formatMoney(vatTotal(10))}</strong><span>СУММА НДС 22%</span><strong>={formatMoney(vatTotal(22))}</strong></div>
                      <div className="receipt-row"><span>ВЫ СЭКОНОМИЛИ, РУБ</span><strong>={formatMoney(receipt.savings ?? 0)}</strong></div>
                    </div>
                    <div className="receipt-rule" />
                    <div className="market-thanks">СПАСИБО ЗА ПОКУПКУ!</div>
                    <div className="receipt-rule" />
                    <div className="receipt-bottom-cluster market-bottom-cluster">
                      <div className="market-footer">
                        <div>КАССИР</div>
                        <div>{receipt.cashier}</div>
                        <div>САЙТ ФНС WWW.NALOG.GOV.RU</div>
                        <div>МЕСТО РАСЧЕТОВ {receipt.place ?? 'МАГАЗИН "РЕМИ"'}</div>
                        <div>КАССА {receipt.register ?? "0006.01"} СМЕНА {receipt.shift ?? "0230"} {formatDate(receipt.date)} {receipt.time}</div>
                        <div>СНО {receipt.taxSystem ?? "ОСН"} ФД {receipt.fiscalDocument ?? "54784"} ФП {receipt.fiscalSign ?? "0082339468"}</div>
                        <div>ЗН ККТ {receipt.rn ?? "0008454318052675"}</div>
                        <div>ФН {receipt.fn ?? "7384440901113190"}</div>
                        <div>РН ККТ {receipt.rn ?? "0008454318052675"} ИНН {receipt.inn ?? "2503029218"}</div>
                        <div>САЙТ ОФД {receipt.ofd ?? "CASH-NNT.KONTUR.RU"}</div>
                      </div>
                      <div className="receipt-qr-slot"><div className="receipt-qr" aria-label="非税务二维码">{qrImage ? <img src={qrImage} alt="本次小票非税务演示二维码" /> : <span>QR</span>}</div></div>
                    </div>
                    <div className="receipt-bottom-line">— — — — — — — — — — — — — — — — — — — — — — — — — —</div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="preview-footer"><span><i className="dot-live" /> 内容会随编辑实时更新</span><span>{currentPaper.content}mm内容宽度</span></div>
        </section>
      </div>
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
