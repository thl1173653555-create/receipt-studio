import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildPrintPageRule } from "../app/print-page.mjs";

test("buildPrintPageRule creates an exact roll-paper page", () => {
  const page = buildPrintPageRule(58, 440);

  assert.equal(page.paperWidthMm, 58);
  assert.ok(page.pageHeightMm > 116 && page.pageHeightMm < 120);
  assert.match(page.css, /^@page \{ size: 58mm \d+(?:\.\d+)?mm; margin: 0; \}$/);
});

test("print button prepares a measured page before opening print", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(pageSource, /async function printReceipt\(\)/);
  assert.match(pageSource, /onClick=\{printReceipt\}/);
  assert.doesNotMatch(pageSource, /onClick=\{\(\) => window\.print\(\)\}/);
});

test("thermal print styles use pure black and readable type", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const printStyles = css.slice(css.indexOf("@media print"));

  assert.match(printStyles, /\.receipt-paper\s*\{[^}]*color:\s*#000/i);
  assert.match(printStyles, /\.paper--58\s*\{[^}]*font-size:\s*10px/i);
  assert.match(printStyles, /\.receipt-rule\s*\{[^}]*border-color:\s*#000/i);
});

test("receipt details and QR stay in their original side-by-side layout", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /\.receipt-tax-fields\s*\{[^}]*width:\s*calc\(100% - var\(--qr-size\) - 1px\)/i);
  assert.match(css, /\.receipt-qr-slot\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/i);
  assert.doesNotMatch(css, /\.receipt-qr-slot\s*\{[^}]*position:\s*relative/i);
  assert.match(css, /\.paper--58 \.receipt-tax-fields\s*\{[^}]*font-size:\s*6\.5px/i);
  assert.match(css, /\.paper--80 \.market-item\s*\{[^}]*grid-template-columns:[^}]*6ch 4ch 3\.5ch 8ch/i);
});

test("receipt font choices include Cyrillic-friendly printer fonts", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(pageSource, /type ReceiptFont = "ticket-mono" \| "courier-new" \| "consolas" \| "arial"/);
  assert.match(pageSource, /name="receipt-font"/);
  assert.match(pageSource, /font--\$\{receiptFont\}/);
  assert.match(pageSource, /font:\s*receiptFont/);
  assert.match(pageSource, /setReceiptFont\(entry\.font \?\? "ticket-mono"\)/);
  assert.match(css, /\.receipt-paper\.font--courier-new\s*\{[^}]*"Courier New"[^}]*font-weight:\s*700/);
  assert.match(css, /\.receipt-paper\.font--consolas\s*\{[^}]*Consolas/);
  assert.match(css, /\.receipt-paper\.font--arial\s*\{[^}]*Arial/);
});
