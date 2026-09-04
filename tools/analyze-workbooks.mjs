import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const root = process.cwd();
const files = [
  "PLANILHA DE CUSTO MARKETPLACE.xlsx",
  "PLANILHA PRECIFICAÇÃO POR FABRICANTE.xlsx",
];

const output = {};

for (const fileName of files) {
  const input = await FileBlob.load(path.join(root, fileName));
  const workbook = await SpreadsheetFile.importXlsx(input);
  const sheetInspection = await workbook.inspect({ kind: "sheet", include: "id,name", maxChars: 20000 });
  const sheetInfo = String(sheetInspection.ndjson ?? "")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const sheets = [];

  for (const entry of sheetInfo) {
    const sheetName = entry.name;
    const sheet = workbook.worksheets.getItem(sheetName);
    const used = sheet.getUsedRange();
    sheets.push({
      name: sheetName,
      address: used?.address ?? null,
      values: used?.values ?? [],
      formulas: used?.formulas ?? [],
      displayFormulas: used?.displayFormulas ?? [],
    });
  }

  output[fileName] = { sheets };
}

await fs.mkdir(path.join(root, ".analysis"), { recursive: true });
await fs.writeFile(
  path.join(root, ".analysis", "workbooks.json"),
  JSON.stringify(output, null, 2),
  "utf8",
);

console.log(JSON.stringify({
  files: Object.fromEntries(Object.entries(output).map(([name, data]) => [name, data.sheets.map((sheet) => ({ name: sheet.name, address: sheet.address }))])),
}, null, 2));
