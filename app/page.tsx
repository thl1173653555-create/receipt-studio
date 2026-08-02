"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";

type PaperFormat = "58" | "80";

type MenuItem = {
  id: string;
  name: string;
  price: number;
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
};

type QrPosition = {
  x: number;
  y: number;
  size: number;
};

type SavedReceipt = {
  id: string;
  savedAt: string;
  format: PaperFormat;
  data: ReceiptData;
  qr: Record<PaperFormat, QrPosition>;
};

const HISTORY_KEY = "beihai-receipt-history-v1";
const MENU_KEY = "beihai-receipt-menu-v1";

const PAPER: Record<PaperFormat, { label: string; paper: number; content: number }> = {
  "58": { label: "58mm / 48mm打印宽度", paper: 58, content: 48 },
  "80": { label: "80mm / 80mm打印宽度", paper: 80, content: 80 },
};

const DEFAULT_MENU: MenuItem[] = [
  {
    id: "fresh-mojito",
    name: 'Напиток CHILLOUT "Fresh Mojito" сильногазированный 0,9 л',
    price: 250,
  },
  { id: "rice-vegetables", name: "85. Рис с овощами 350гр", price: 400 },
  {
    id: "sichuan-meat",
    name: "34. Мясо в бутылочке по Сычуаньски 400гр.",
    price: 800,
  },
];

const DEFAULT_RECEIPT: ReceiptData = {
  storeName: 'РЕСТОРАН КИТАЙСКОЙ КУХНИ "БЭЙ ХАЙ"',
  company: 'Общество с ограниченной ответственностью "ВЕРЕСК"',
  address: "25 — Приморский край, г. Большой Камень, 692806, г. Большой Камень, ул. Приморского Комсомола, д. 2",
  cashier: "МАЛИНОВСКИЙ Р. В. ДИРЕКТОР",
  date: "2026-07-19",
  time: "21:09",
  saleNumber: "7056",
  payment: "БАНК. КАРТОЙ",
  items: DEFAULT_MENU.map((item) => ({ ...item, qty: 1 })),
};

const DEFAULT_QR: Record<PaperFormat, QrPosition> = {
  "58": { x: 11, y: 1, size: 26 },
  "80": { x: 24, y: 1, size: 32 },
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

export default function Home() {
  const [format, setFormat] = useState<PaperFormat>("58");
  const [receipt, setReceipt] = useState<ReceiptData>(DEFAULT_RECEIPT);
  const [qrPositions, setQrPositions] = useState(DEFAULT_QR);
  const [menu, setMenu] = useState<MenuItem[]>(DEFAULT_MENU);
  const [history, setHistory] = useState<SavedReceipt[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [newMenuName, setNewMenuName] = useState("");
  const [newMenuPrice, setNewMenuPrice] = useState("0");
  const [notice, setNotice] = useState("");

  const total = useMemo(
    () => receipt.items.reduce((sum, item) => sum + item.qty * item.price, 0),
    [receipt.items],
  );

  const qrPayload = useMemo(() => {
    const itemLines = receipt.items
      .map((item) => `${item.name} x${item.qty}=${formatMoney(item.qty * item.price)}`)
      .join("; ");

    return [
      `STORE=${receipt.storeName}`,
      `DATE=${receipt.date}`,
      `TIME=${receipt.time}`,
      `RECEIPT_NO=${receipt.saleNumber}`,
      `TOTAL_RUB=${formatMoney(total)}`,
      `PAYMENT=${receipt.payment}`,
      `ITEMS=${receipt.items.length}`,
      `DETAILS=${itemLines}`,
    ].join("\n");
  }, [receipt, total]);

  useEffect(() => {
    setHistory(readLocal<SavedReceipt[]>(HISTORY_KEY, []));
    setMenu(readLocal<MenuItem[]>(MENU_KEY, DEFAULT_MENU));
  }, []);

  useEffect(() => {
    QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 512,
      color: { dark: "#151515", light: "#fffdf8" },
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

  function updateReceipt<K extends keyof ReceiptData>(field: K, value: ReceiptData[K]) {
    setReceipt((current) => ({ ...current, [field]: value }));
    setActiveId(null);
  }

  function updateQr(field: keyof QrPosition, rawValue: string) {
    const value = Math.max(0, Number(rawValue) || 0);
    const maximum = field === "x" ? currentPaper.content - qr.size : field === "size" ? currentPaper.content : 120;
    const nextValue = Math.min(value, Math.max(0, maximum));
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

  function addCustomMenuItem(saveToMenu: boolean) {
    const name = newMenuName.trim();
    const price = Math.max(0, Number(newMenuPrice) || 0);
    if (!name) {
      setNotice("请先填写菜品名称");
      return;
    }
    const item = { id: makeId(), name, price };
    if (saveToMenu) {
      const nextMenu = [...menu, item];
      setMenu(nextMenu);
      window.localStorage.setItem(MENU_KEY, JSON.stringify(nextMenu));
      setNotice("已保存到常用菜单并加入本单");
    } else {
      setNotice("已加入本单");
    }
    addToOrder(item);
    setNewMenuName("");
    setNewMenuPrice("0");
  }

  function deleteMenuItem(id: string) {
    const nextMenu = menu.filter((item) => item.id !== id);
    setMenu(nextMenu);
    window.localStorage.setItem(MENU_KEY, JSON.stringify(nextMenu));
    setNotice("已从常用菜单移除");
  }

  function saveReceipt() {
    const entry: SavedReceipt = {
      id: activeId ?? makeId(),
      savedAt: new Date().toISOString(),
      format,
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
    setReceipt(entry.data);
    setFormat(entry.format);
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
    setReceipt({ ...DEFAULT_RECEIPT, items: DEFAULT_RECEIPT.items.map((item) => ({ ...item, id: makeId() })) });
    setFormat("58");
    setQrPositions(DEFAULT_QR);
    setActiveId(null);
    setNotice("已新建小票");
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
          <div className="control-card">
            <div className="card-heading">
              <div><span className="section-index">01</span><h3>纸张规格</h3></div>
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
          </div>

          <div className="control-card">
            <div className="card-heading">
              <div><span className="section-index">02</span><h3>店铺与订单</h3></div>
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
          </div>

          <div className="control-card menu-card">
            <div className="card-heading">
              <div><span className="section-index">03</span><h3>选择菜单</h3></div>
              <span className="muted">点击加入本单</span>
            </div>
            <div className="menu-list">
              {menu.map((item, index) => (
                <div className="menu-row" key={item.id}>
                  <div className="menu-number">{String(index + 1).padStart(2, "0")}</div>
                  <div className="menu-copy"><strong>{item.name}</strong><span>{formatMoney(item.price)} ₽</span></div>
                  <button className="icon-button add-button" onClick={() => addToOrder(item)} aria-label={`加入${item.name}`}>+</button>
                  {index >= DEFAULT_MENU.length && <button className="icon-button delete-button" onClick={() => deleteMenuItem(item.id)} aria-label={`删除${item.name}`}>×</button>}
                </div>
              ))}
            </div>
            <div className="custom-menu-form">
              <div className="small-label">新增菜品 / 可保存到常用菜单</div>
              <div className="field-grid custom-grid">
                <input placeholder="俄文菜品名称" value={newMenuName} onChange={(event) => setNewMenuName(event.target.value)} />
                <input type="number" min="0" step="0.01" placeholder="单价" value={newMenuPrice} onChange={(event) => setNewMenuPrice(event.target.value)} />
              </div>
              <div className="custom-actions">
                <button className="button button-soft" onClick={() => addCustomMenuItem(false)}>仅加入本单</button>
                <button className="button button-outline" onClick={() => addCustomMenuItem(true)}>保存并加入</button>
              </div>
            </div>
          </div>

          <div className="control-card">
            <div className="card-heading">
              <div><span className="section-index">04</span><h3>本次点单</h3></div>
              <span className="total-chip">{formatMoney(total)} ₽</span>
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
              <div><span className="section-index">05</span><h3>二维码位置</h3></div>
              <span className="muted">单位：mm / {format}mm</span>
            </div>
            <div className="qr-position-grid">
              <label className="field-label">X 左右<input type="number" min="0" max={currentPaper.content} value={qr.x} onChange={(event) => updateQr("x", event.target.value)} /></label>
              <label className="field-label">Y 上下<input type="number" min="0" max="120" value={qr.y} onChange={(event) => updateQr("y", event.target.value)} /></label>
              <label className="field-label">尺寸<input type="number" min="14" max={currentPaper.content} value={qr.size} onChange={(event) => updateQr("size", event.target.value)} /></label>
            </div>
            <div className="qr-payload-box"><div><span className="small-label">扫码后显示的文本</span><span className="plain-badge">非税务数据</span></div><textarea readOnly value={qrPayload} /></div>
          </div>

          <div className="control-card history-card">
            <div className="card-heading">
              <div><span className="section-index">06</span><h3>本机历史</h3></div>
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
          <div className="preview-header"><div><span className="eyebrow accent">LIVE PREVIEW</span><h3>打印预览</h3></div><button className="button button-print" onClick={() => window.print()}><span>↗</span> 打印小票</button></div>
          <div className="preview-stage">
            <div className={`receipt-page page--${format}`} style={{ ["--paper-width" as string]: `${currentPaper.paper}mm` } as React.CSSProperties}>
              <div id="print-area" className={`receipt-paper paper--${format}`} style={{ ["--content-width" as string]: `${currentPaper.content}mm`, ["--qr-x" as string]: `${qr.x}mm`, ["--qr-y" as string]: `${qr.y}mm`, ["--qr-size" as string]: `${qr.size}mm` } as React.CSSProperties}>
                <div className="receipt-top-line">— — — — — — — — — — — —</div>
                <div className="receipt-store">{receipt.storeName}</div>
                <div className="receipt-subtitle">КАССОВЫЙ ЧЕК</div>
                <div className="receipt-rule" />
                <div className="receipt-items">
                  {receipt.items.map((item) => <div className="receipt-item" key={item.id}>
                    <div className="receipt-item-name">{item.name}</div>
                    <div className="receipt-item-price"><span>{formatMoney(item.price)}*{item.qty} шт.</span><strong>= {formatMoney(item.qty * item.price)}</strong></div>
                    <div className="receipt-tax">НДС не облагается</div>
                  </div>)}
                </div>
                <div className="receipt-rule" />
                <div className="receipt-summary">
                  <div className="receipt-row"><span>Номер продажи</span><strong>{receipt.saleNumber}</strong></div>
                  <div className="receipt-row receipt-grand-total"><span>ИТОГ</span><strong>= {formatMoney(total)}</strong></div>
                  <div className="receipt-row"><span>СУММА БЕЗ НДС</span><strong>= {formatMoney(total)}</strong></div>
                  <div className="receipt-row"><span>БЕЗНАЛИЧНЫМИ</span><strong>= {formatMoney(total)}</strong></div>
                  <div className="receipt-row"><span>*{receipt.payment}</span><strong>= {formatMoney(total)}</strong></div>
                </div>
                <div className="receipt-rule" />
                <div className="receipt-company"><div>КАССИР <span>{receipt.cashier}</span></div><div>{receipt.company}</div><div>{receipt.address}</div><div>МЕСТО РАСЧЕТОВ <span>Ресторан "Бэйхай"</span></div></div>
                <div className="receipt-tax-fields">{DEMO_TAX_FIELDS.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}<div><span>{formatDate(receipt.date)} {receipt.time}</span><strong /></div><div className="receipt-income">ПРИХОД</div></div>
                <div className="receipt-qr-slot"><div className="receipt-qr" aria-label="非税务二维码">{qrImage ? <img src={qrImage} alt="本次小票二维码" /> : <span>QR</span>}</div></div>
                <div className="receipt-bottom-line">— — — — — — — — — — — —</div>
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
