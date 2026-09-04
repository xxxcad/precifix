import fs from "node:fs/promises";

const analysis = JSON.parse(await fs.readFile(".analysis/workbooks.json", "utf8"));
const workbook = analysis["PLANILHA PRECIFICAÇÃO POR FABRICANTE.xlsx"];

function columnName(index) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

for (const sheet of workbook.sheets) {
  console.log(`\n### ${sheet.name} (${sheet.address})`);
  for (let rowIndex = 0; rowIndex < Math.min(sheet.values.length, 8); rowIndex += 1) {
    const populated = sheet.values[rowIndex]
      .map((value, columnIndex) => ({ cell: `${columnName(columnIndex)}${rowIndex + 1}`, value }))
      .filter(({ value }) => value !== null && value !== "" && value !== undefined);
    if (populated.length) console.log(JSON.stringify(populated));
  }
}
