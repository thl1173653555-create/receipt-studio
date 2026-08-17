/**
 * 随机配餐算法(纯函数,随机源可注入,便于单元测试)。
 *
 * - 主菜优先:每张小票至少一道主菜(餐厅:热菜/主食;超市:食品类),保证饮食逻辑
 * - 零食限制:饮品/酒水/甜品(超市:Сладости/Напитки)每类最多 1 种、合计最多 2 种,
 *   且只卖 1 份 —— 一顿饭不能全是饮料
 * - 金额约束:总金额落在 [min, max] 内;凑不出时返回带建议的提示词
 */

export const MAIN_CATEGORIES = {
  restaurant: ["热菜", "主食"],
  supermarket: ["Бакалея", "Хлеб и выпечка", "Молочные продукты", "Заморозка"],
  "russian-restaurant": ["Первые блюда", "Горячие блюда"],
  grill: ["Мясо на углях", "Птица"],
  kiosk: ["Продукты"],
};

export const DEFAULT_WEIGHTS = {
  restaurant: {
    热菜: 5,
    主食: 4,
    冷菜: 4,
    其他: 2,
    饮品: 1,
    酒水: 1,
    甜品: 1,
  },
  supermarket: {
    Бакалея: 5,
    "Хлеб и выпечка": 4,
    "Молочные продукты": 4,
    Заморозка: 3,
    "Консервы и соусы": 3,
    Снеки: 2,
    "Для дома": 1,
    Сладости: 1,
    Напитки: 1,
    "Красота и уход": 1,
    "Товары для животных": 1,
  },
  "russian-restaurant": {
    Закуски: 4,
    "Первые блюда": 4,
    "Горячие блюда": 5,
    Гарниры: 3,
    Десерты: 2,
    Напитки: 2,
  },
  grill: {
    "Мясо на углях": 5,
    Птица: 3,
    "Овощи гриль": 3,
    Соусы: 2,
    "Хлеб и лепёшки": 2,
    Напитки: 2,
  },
  kiosk: {
    Продукты: 5,
    Напитки: 3,
    "Сладости и снеки": 3,
    Мороженое: 3,
    "Табачные изделия": 2,
    Хозтовары: 1,
    Алкоголь: 2,
  },
};

/** 零食/饮料类:每类最多 1 种,合计最多 2 种,且只卖 1 份 */
const SNACK_LIKE = {
  restaurant: ["饮品", "酒水", "甜品"],
  supermarket: ["Сладости", "Напитки"],
  "russian-restaurant": ["Десерты", "Напитки"],
  grill: ["Соусы", "Напитки"],
  kiosk: ["Мороженое", "Сладости и снеки"],
};

/** 单张小票最多商品种数 */
const MAX_KINDS = 6;

export function randInt(min, max, rand = Math.random) {
  return min + Math.floor(rand() * (max - min + 1));
}

export function fmtMoney(value) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0$/, "");
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

/** 在 [from, to] 日期段内随机一天,返回 yyyy-MM-dd;from > to 时自动交换 */
export function randomDate(from, to, rand = Math.random) {
  let start = new Date(`${from}T00:00:00`);
  let end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return from || to || "";
  if (start > end) [start, end] = [end, start];
  const daySpan = Math.round((end.getTime() - start.getTime()) / 86400000);
  const chosen = new Date(start.getTime() + randInt(0, daySpan, rand) * 86400000);
  return `${chosen.getFullYear()}-${pad2(chosen.getMonth() + 1)}-${pad2(chosen.getDate())}`;
}

/** 在 [from, to] 时间段内随机一分钟,返回 HH:mm;from > to 时自动交换 */
export function randomTime(from, to, rand = Math.random) {
  const parse = (value) => {
    const [h, m] = String(value).split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
  };
  let a = parse(from);
  let b = parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return from || to || "";
  if (a > b) [a, b] = [b, a];
  const minute = randInt(a, b, rand);
  return `${pad2(Math.floor(minute / 60))}:${pad2(minute % 60)}`;
}

function pickWeighted(pairs, totalWeight, rand) {
  let roll = rand() * totalWeight;
  for (const [key, weight] of pairs) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return pairs[pairs.length - 1][0];
}

/**
 * 按金额区间配出一顿饭。
 *
 * @param {Array} menu 菜单(含 name/price/category,可选 code/vat/id)
 * @param {{min:number, max:number, weights:Record<string,number>, scenario:string}} options
 * @param {() => number} [rand] 随机源,默认 Math.random
 * @returns {{ok:true, items:Array, total:number} | {ok:false, error:string}}
 */
export function composeMeal(menu, options, rand = Math.random) {
  const { min, max, weights, scenario } = options;
  const mainCategories = MAIN_CATEGORIES[scenario] ?? MAIN_CATEGORIES.restaurant;
  const snackLike = SNACK_LIKE[scenario] ?? SNACK_LIKE.restaurant;

  if (!Array.isArray(menu) || menu.length === 0) {
    return { ok: false, error: "菜单为空:没有可用菜品,请先在小票生成器的菜单中添加菜品。" };
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) {
    return { ok: false, error: "金额范围无效:请确认下限 ≤ 上限,且都是正数。" };
  }

  const byCategory = new Map();
  for (const item of menu) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }

  const categories = Object.keys(weights).filter(
    (cat) => weights[cat] > 0 && (byCategory.get(cat)?.length ?? 0) > 0,
  );
  if (categories.length === 0) {
    return { ok: false, error: "没有可用类别:所有类别的权重都是 0,或菜单里没有这些类别的菜品。" };
  }
  const weightPairs = categories.map((cat) => [cat, weights[cat]]);
  const totalWeight = weightPairs.reduce((sum, [, w]) => sum + w, 0);

  const mainPairs = weightPairs.filter(([cat]) => mainCategories.includes(cat));
  if (mainPairs.length === 0) {
    return {
      ok: false,
      error: "没有可选的主菜类别(热菜/主食等权重为 0 或没有对应菜品):一顿饭不能没有主菜。",
    };
  }

  const mainCandidates = mainPairs.flatMap(([cat]) => byCategory.get(cat));
  const cheapestMain = mainCandidates.reduce((a, b) => (a.price <= b.price ? a : b));
  if (cheapestMain.price > max) {
    return {
      ok: false,
      error: `金额上限 ${fmtMoney(max)} ₽ 连最便宜的主菜都不够:「${cheapestMain.name}」${fmtMoney(cheapestMain.price)} ₽。请调高金额上限。`,
    };
  }

  // ── 第一步:必选一道主菜 ──────────────────────────────
  const mainWeight = mainPairs.reduce((sum, [, w]) => sum + w, 0);
  const mainCat = pickWeighted(mainPairs, mainWeight, rand);
  const mainList = byCategory.get(mainCat);
  const mainItem = mainList[Math.floor(rand() * mainList.length)];

  const picked = [{ ...mainItem, qty: 1 }];
  const snackKinds = new Set();
  if (snackLike.includes(mainItem.category)) snackKinds.add(mainItem.category);
  let total = mainItem.price;

  // ── 第二步:按权重补菜,尽量接近目标金额 ──────────────
  const target = randInt(min, max, rand);
  let guard = 0;
  while (total < target && picked.length < MAX_KINDS && guard++ < 60) {
    const available = weightPairs.filter(([cat]) =>
      snackLike.includes(cat) ? !snackKinds.has(cat) : true,
    );
    if (available.length === 0) break;
    const cat = pickWeighted(
      available,
      available.reduce((sum, [, w]) => sum + w, 0),
      rand,
    );
    const candidates = byCategory.get(cat).filter((item) => item.price + total <= max);
    if (candidates.length === 0) continue;
    const item = candidates[Math.floor(rand() * candidates.length)];
    let qty = 1;
    if (!snackLike.includes(cat) && item.price * 2 + total <= max && rand() < 0.45) qty = 2;
    picked.push({ ...item, qty });
    total += item.price * qty;
    if (snackLike.includes(cat)) snackKinds.add(cat);
  }

  // ── 第三步:补到下限(加量优先,其次加菜,选最接近缺口的) ──
  guard = 0;
  while (total < min && guard++ < 50) {
    const gap = min - total;
    let best = null;
    for (const entry of picked) {
      if (snackLike.includes(entry.category)) continue;
      if (entry.price + total > max) continue;
      const score = Math.abs(entry.price - gap);
      if (!best || score < best.score) best = { kind: "qty", entry, score };
    }
    if (picked.length < MAX_KINDS) {
      for (const cat of categories) {
        if (snackLike.includes(cat) && snackKinds.has(cat)) continue;
        for (const item of byCategory.get(cat)) {
          if (item.price + total > max) continue;
          const score = Math.abs(item.price - gap);
          if (!best || score < best.score) best = { kind: "add", cat, item, score };
        }
      }
    }
    if (!best) break;
    if (best.kind === "qty") {
      best.entry.qty += 1;
      total += best.entry.price;
    } else {
      picked.push({ ...best.item, qty: 1 });
      total += best.item.price;
      if (snackLike.includes(best.cat)) snackKinds.add(best.cat);
    }
  }

  if (total < min) {
    return {
      ok: false,
      error: `无法在 ${fmtMoney(min)}–${fmtMoney(max)} ₽ 内配出这顿饭:当前菜单与权重下最多配到约 ${fmtMoney(total)} ₽(${picked.length} 种商品)。建议降低金额下限、提高主菜/冷菜权重,或扩大金额区间。`,
    };
  }

  return {
    ok: true,
    total: Math.round(total * 100) / 100,
    items: picked.map(({ id, name, price, category, code, vat, qty }) => ({
      id,
      name,
      price,
      category,
      code,
      vat,
      qty,
    })),
  };
}
