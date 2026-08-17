import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server renders the receipt workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /餐馆小票生成器/);
  assert.match(html, /58mm[\s\S]*48mm打印宽度/);
  assert.match(html, /80mm[\s\S]*80mm打印宽度/);
  assert.match(html, /非税务二维码模式/);
  assert.match(html, /t=\d{8}T\d{4}&(?:amp;)?s=\d+\.\d{2}&(?:amp;)?fn=\d+&(?:amp;)?i=\d+&(?:amp;)?fp=\d+&(?:amp;)?n=1/);
  assert.match(html, /业务场景/);
  assert.match(html, /超市/);
  assert.match(html, /搜索菜单/);
  assert.match(html, /ЗН ККТ/);
  assert.match(html, /ПРИХОД/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site|codex-preview/i);
});

test("supermarket library contains 50 products", async () => {
  const fileUrl = new URL("../data/supermarket-menu.json", import.meta.url);
  const products = JSON.parse(await readFile(fileUrl, "utf8"));
  assert.equal(products.length, 50);
  assert.equal(products[0].code, "057974");
  assert.equal(products[0].price, 77.99);
  assert.equal(products[6].code, "015045");
});

test("supermarket receipt template is wired into the page", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(pageSource, /receipt--\$\{scenario\}/);
  assert.match(pageSource, /КОД ТОВАРА/);
  assert.match(pageSource, /СУММА НДС 10%/);
  assert.match(pageSource, /ВЫ СЭКОНОМИЛИ/);
  assert.match(pageSource, /СПАСИБО ЗА ПОКУПКУ/);
});

test("new scenarios are offered and their menus are wired in", async () => {
  const response = await render();
  const html = await response.text();
  assert.match(html, /俄餐厅/);
  assert.match(html, /烧烤厅/);
  assert.match(html, /小卖部/);
  assert.match(html, /Шашлычная/);
  assert.match(html, /Киоск 24 часа/);

  const russian = JSON.parse(await readFile(new URL("../data/russian-menu.json", import.meta.url), "utf8"));
  assert.equal(russian.length, 24);
  assert.equal(russian[0].category, "Закуски");
  const grill = JSON.parse(await readFile(new URL("../data/grill-menu.json", import.meta.url), "utf8"));
  assert.equal(grill.length, 21);
  assert.equal(grill[0].category, "Мясо на углях");
  const kiosk = JSON.parse(await readFile(new URL("../data/kiosk-menu.json", import.meta.url), "utf8"));
  assert.equal(kiosk.length, 23);
  assert.equal(kiosk[0].category, "Продукты");
});

test("new receipt templates keep fiscal fields and QR wiring", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(pageSource, /ДОБРО ПОЖАЛОВАТЬ/);
  assert.match(pageSource, /БЛАГОДАРИМ ЗА ВИЗИТ/);
  assert.match(pageSource, /ЖАРИМ НА УГЛЯХ/);
  assert.match(pageSource, /ПРИЯТНОГО АППЕТИТА/);
  assert.match(pageSource, /У НАС ДЕШЕВЛЕ/);
  assert.match(pageSource, /СДАЧА/);
  assert.match(pageSource, /АДМИНИСТРАТОР: ____/);
  assert.match(pageSource, /russian-fiscal/);
  assert.match(pageSource, /grill-fiscal/);
  assert.match(pageSource, /kiosk-fiscal/);
  assert.match(pageSource, /ОПЕРАЦИЯ/);
});
