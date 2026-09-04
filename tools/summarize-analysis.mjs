import fs from "node:fs/promises";

const analysis = JSON.parse(await fs.readFile(".analysis/workbooks.json", "utf8"));

function columnNumber(label) {
  return [...label].reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0);
}

function cell(sheet, address) {
  const [, startColumn, startRow] = sheet.address.match(/^([A-Z]+)(\d+):?/);
  const [, column, row] = address.match(/^([A-Z]+)(\d+)$/);
  const r = Number(row) - Number(startRow);
  const c = columnNumber(column) - columnNumber(startColumn);
  return {
    value: sheet.values?.[r]?.[c] ?? null,
    formula: sheet.formulas?.[r]?.[c] ?? null,
    displayFormula: sheet.displayFormulas?.[r]?.[c] ?? null,
  };
}

const costWorkbook = analysis["PLANILHA DE CUSTO MARKETPLACE.xlsx"];
const cellSets = {
  "Mercado Livre": ["D5", "D6", "D7", "D8", "D10", "D13", "D15", "D16", "D18", "G5", "G6", "G22", "G27", "G28"],
  Shopee: ["D5", "D6", "D7", "D8", "D10", "D13", "D15", "D16", "D18", "G5", "G6", "G29", "G30"],
  Amazon: ["C5", "C6", "C7", "C8", "C10", "C13", "C15", "C17", "F5", "F6", "F22", "F27", "F28"],
};

const output = {};
for (const sheet of costWorkbook.sheets) {
  const kind = sheet.name.startsWith("Shopee") ? "Shopee" : sheet.name.startsWith("Amazon") ? "Amazon" : "Mercado Livre";
  output[sheet.name] = Object.fromEntries(cellSets[kind].map((address) => [address, cell(sheet, address)]));
}

console.log(JSON.stringify(output, null, 2));
