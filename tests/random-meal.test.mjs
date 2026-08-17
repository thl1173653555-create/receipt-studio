import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DEFAULT_WEIGHTS,
  MAIN_CATEGORIES,
  composeMeal,
  fmtMoney,
  randomDate,
  randomTime,
} from "../app/random-meal.mjs";

/** 确定性随机源(LCG),让测试可复现 */
function lcg(seed = 42) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const restaurantMenu = JSON.parse(
  await readFile(new URL("../data/menu.json", import.meta.url), "utf8"),
);
const supermarketMenu = JSON.parse(
  await readFile(new URL("../data/supermarket-menu.json", import.meta.url), "utf8"),
);
const russianMenu = JSON.parse(
  await readFile(new URL("../data/russian-menu.json", import.meta.url), "utf8"),
);
const grillMenu = JSON.parse(
  await readFile(new URL("../data/grill-menu.json", import.meta.url), "utf8"),
);
const kioskMenu = JSON.parse(
  await readFile(new URL("../data/kiosk-menu.json", import.meta.url), "utf8"),
);

const RESTAURANT_WEIGHTS = {
  热菜: 5, 主食: 4, 冷菜: 4, 其他: 2, 饮品: 1, 酒水: 1, 甜品: 1,
};

test("restaurant meal lands inside the amount range and has a main dish", () => {
  for (let seed = 1; seed <= 25; seed++) {
    const meal = composeMeal(restaurantMenu, {
      min: 1000,
      max: 1500,
      weights: RESTAURANT_WEIGHTS,
      scenario: "restaurant",
    }, lcg(seed));

    assert.equal(meal.ok, true, `seed ${seed} should compose`);
    assert.ok(meal.total >= 1000 && meal.total <= 1500, `seed ${seed}: total ${meal.total}`);
    assert.ok(meal.items.some((item) => MAIN_CATEGORIES.restaurant.includes(item.category)),
      `seed ${seed}: must include a main dish`);
  }
});

test("meal respects the drink rule: at most 2 snack-like kinds, one portion each", () => {
  const snackLike = ["饮品", "酒水", "甜品"];
  for (let seed = 1; seed <= 25; seed++) {
    const meal = composeMeal(restaurantMenu, {
      min: 600,
      max: 2000,
      weights: RESTAURANT_WEIGHTS,
      scenario: "restaurant",
    }, lcg(seed));
    assert.equal(meal.ok, true);

    const snacks = meal.items.filter((item) => snackLike.includes(item.category));
    assert.ok(snacks.length <= 2, `seed ${seed}: snack kinds ${snacks.length}`);
    assert.ok(snacks.every((item) => item.qty === 1), `seed ${seed}: snacks must be qty 1`);
    const kinds = new Set(snacks.map((item) => item.category));
    assert.equal(kinds.size, snacks.length, `seed ${seed}: one kind per snack category`);
  }
});

test("supermarket meal lands inside the range and includes a food staple", () => {
  for (let seed = 1; seed <= 25; seed++) {
    const meal = composeMeal(supermarketMenu, {
      min: 300,
      max: 600,
      weights: {
        Бакалея: 5, "Хлеб и выпечка": 4, "Молочные продукты": 4, Заморозка: 3,
        "Консервы и соусы": 3, Снеки: 2, "Для дома": 1, Сладости: 1,
        Напитки: 1, "Красота и уход": 1, "Товары для животных": 1,
      },
      scenario: "supermarket",
    }, lcg(seed + 100));

    assert.equal(meal.ok, true, `seed ${seed} should compose`);
    assert.ok(meal.total >= 300 && meal.total <= 600, `seed ${seed}: total ${meal.total}`);
    assert.ok(meal.items.some((item) => MAIN_CATEGORIES.supermarket.includes(item.category)),
      `seed ${seed}: must include a food staple`);
  }
});

const NEW_SCENARIOS = [
  { scenario: "russian-restaurant", menu: russianMenu, min: 1000, max: 2000 },
  { scenario: "grill", menu: grillMenu, min: 500, max: 1200 },
  { scenario: "kiosk", menu: kioskMenu, min: 150, max: 500 },
];

test("new scenarios compose meals with a main item inside the range", () => {
  for (const { scenario, menu, min, max } of NEW_SCENARIOS) {
    for (let seed = 1; seed <= 25; seed++) {
      const meal = composeMeal(menu, {
        min,
        max,
        weights: DEFAULT_WEIGHTS[scenario],
        scenario,
      }, lcg(seed));

      assert.equal(meal.ok, true, `${scenario} seed ${seed} should compose`);
      assert.ok(meal.total >= min && meal.total <= max, `${scenario} seed ${seed}: total ${meal.total}`);
      assert.ok(
        meal.items.some((item) => MAIN_CATEGORIES[scenario].includes(item.category)),
        `${scenario} seed ${seed}: must include a main item`,
      );
    }
  }
});

test("random page offers all five scenarios", async () => {
  const pageSource = await readFile(new URL("../app/random/page.tsx", import.meta.url), "utf8");
  assert.match(pageSource, /russian-restaurant/);
  assert.match(pageSource, /grill/);
  assert.match(pageSource, /kiosk/);
  assert.match(pageSource, /ШАШЛЫЧНАЯ/);
  assert.match(pageSource, /ПРОДУКТЫ 24 ЧАСА/);
});

test("new scenarios cap snack-like kinds at two, one portion each", () => {
  const SNACKS = {
    "russian-restaurant": ["Десерты", "Напитки"],
    grill: ["Соусы", "Напитки"],
    kiosk: ["Мороженое", "Сладости и снеки"],
  };
  for (const { scenario, menu, min, max } of NEW_SCENARIOS) {
    for (let seed = 1; seed <= 25; seed++) {
      const meal = composeMeal(menu, {
        min,
        max,
        weights: DEFAULT_WEIGHTS[scenario],
        scenario,
      }, lcg(seed + 500));
      assert.equal(meal.ok, true, `${scenario} seed ${seed} should compose`);

      const snacks = meal.items.filter((item) => SNACKS[scenario].includes(item.category));
      const kinds = new Set(snacks.map((item) => item.category));
      assert.ok(kinds.size <= 2, `${scenario} seed ${seed}: snack kinds ${kinds.size}`);
      assert.ok(snacks.every((item) => item.qty === 1), `${scenario} seed ${seed}: snacks must be qty 1`);
    }
  }
});

test("fails with a helpful message when the budget is below the cheapest dish", () => {
  const meal = composeMeal(restaurantMenu, {
    min: 1,
    max: 5,
    weights: RESTAURANT_WEIGHTS,
    scenario: "restaurant",
  }, lcg(7));

  assert.equal(meal.ok, false);
  assert.match(meal.error, /金额上限/);
  assert.match(meal.error, /₽/);
});

test("fails when even the full menu cannot reach the lower bound", () => {
  const meal = composeMeal(restaurantMenu, {
    min: 100000,
    max: 200000,
    weights: RESTAURANT_WEIGHTS,
    scenario: "restaurant",
  }, lcg(7));

  assert.equal(meal.ok, false);
  assert.match(meal.error, /无法在/);
  assert.match(meal.error, /建议/);
});

test("fails when main-dish weights are all zero", () => {
  const meal = composeMeal(restaurantMenu, {
    min: 1000,
    max: 1500,
    weights: { 冷菜: 4, 饮品: 4, 甜品: 4 },
    scenario: "restaurant",
  }, lcg(7));

  assert.equal(meal.ok, false);
  assert.match(meal.error, /主菜/);
});

test("randomDate stays inside the requested range (and swaps reversed bounds)", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const date = randomDate("2026-07-01", "2026-07-31", lcg(seed));
    assert.ok(date >= "2026-07-01" && date <= "2026-07-31", `seed ${seed}: ${date}`);
  }
  for (let seed = 1; seed <= 20; seed++) {
    const date = randomDate("2026-07-31", "2026-07-01", lcg(seed));
    assert.ok(date >= "2026-07-01" && date <= "2026-07-31", `reversed seed ${seed}: ${date}`);
  }
  assert.equal(randomDate("2026-07-01", "2026-07-01", lcg(1)), "2026-07-01");
});

test("randomTime stays inside the requested range", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const time = randomTime("09:00", "21:30", lcg(seed));
    assert.ok(time >= "09:00" && time <= "21:30", `seed ${seed}: ${time}`);
  }
  assert.equal(randomTime("12:00", "12:00", lcg(1)), "12:00");
});

test("fmtMoney rounds to two decimals without trailing zeros", () => {
  assert.equal(fmtMoney(77.99 * 2), "155.98");
  assert.equal(fmtMoney(1000), "1000");
  assert.equal(fmtMoney(0.1 + 0.2), "0.3");
});

test("random page wires the meal module and history kind", async () => {
  const pageSource = await readFile(new URL("../app/random/page.tsx", import.meta.url), "utf8");
  const homeSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(pageSource, /composeMeal\(/);
  assert.match(pageSource, /HISTORY_KEY/);
  assert.match(pageSource, /kind: "random"/);
  assert.match(pageSource, /href="\/"/);
  assert.match(homeSource, /href="\/random"/);
  assert.match(homeSource, /historyTab/);
  assert.match(homeSource, /kind: history\.find/);
});
