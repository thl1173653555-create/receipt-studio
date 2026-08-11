const CSS_PIXELS_PER_MM = 96 / 25.4;
const PAGE_HEIGHT_PADDING_MM = 1.5;
const PAGE_HEIGHT_STEP_MM = 0.5;

function formatMillimetres(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

export function buildPrintPageRule(paperWidthMm, receiptHeightPx) {
  if (!Number.isFinite(paperWidthMm) || paperWidthMm <= 0) {
    throw new RangeError("paperWidthMm must be a positive number");
  }
  if (!Number.isFinite(receiptHeightPx) || receiptHeightPx <= 0) {
    throw new RangeError("receiptHeightPx must be a positive number");
  }

  const measuredHeightMm = receiptHeightPx / CSS_PIXELS_PER_MM;
  const pageHeightMm = Math.ceil(
    (measuredHeightMm + PAGE_HEIGHT_PADDING_MM) / PAGE_HEIGHT_STEP_MM,
  ) * PAGE_HEIGHT_STEP_MM;
  const width = formatMillimetres(paperWidthMm);
  const height = formatMillimetres(pageHeightMm);

  return {
    paperWidthMm,
    pageHeightMm,
    css: `@page { size: ${width}mm ${height}mm; margin: 0; }`,
  };
}
