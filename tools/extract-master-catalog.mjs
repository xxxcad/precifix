import fs from "node:fs/promises";

const source = JSON.parse(await fs.readFile(".analysis/workbooks.json", "utf8"));
const workbook = source["PLANILHA PRECIFICAÇÃO POR FABRICANTE.xlsx"];

const normalize = (value) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toUpperCase();

const decimal = (value, fallback = "0") => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") {
    const cleaned = value.trim().replace(/^R\$\s*/, "").replace(/\./g, "").replace(",", ".");
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return String(parsed);
  }
  return fallback;
};

const positive = (value) => Number(decimal(value)) > 0;
const text = (value) => value === null || value === undefined ? "" : String(value).trim();
const skuText = (value) => typeof value === "number" && Number.isInteger(value) ? String(value) : text(value);

const ruleMap = new Map([
  ["NACIONAL", "NACIONAL"],
  ["NACIONAL ST", "NACIONAL_ST"],
  ["NACIONALST", "NACIONAL_ST"],
  ["IMPORTADO", "IMPORTADO"],
  ["IMPORTADO ST", "IMPORTADO_ST"],
  ["IMPORTADOST", "IMPORTADO_ST"],
  ["ISENTO", "ISENTO"],
]);

function indexesFor(header) {
  const groups = new Map();
  header.forEach((value, index) => {
    const key = normalize(value);
    if (!key) return;
    groups.set(key, [...(groups.get(key) ?? []), index]);
  });
  const at = (label, occurrence = 0) => groups.get(normalize(label))?.[occurrence] ?? -1;
  return {
    sku: at("SKU"), manufacturerCode: at("COD FAB"), name: at("PRODUTO"), cost: at("CUSTO"),
    st: at("ST"), fiscalRule: at("PRECIFICAÇÃO"), inputIcms: at("ICMS"), inputPis: at("PIS"),
    inputCofins: at("COFINS"), inputIpi: at("IPI"), outputSp: at("ICMS SP"), outputSs: at("ICMS SS"),
    outputNn: at("ICMS NN"), mlCommission: at("COMISSÃO", 0), mlFreight: at("FRETE", 1),
    mlPrice: at("ML"), shopeePrice: at("SHOPEE"), amazonCommission: at("COMISSÃO", 2),
    amazonFreight: at("FRETE", 2), amazonPrice: at("AMAZON"),
  };
}

const products = [];
const issues = [];
const suppliers = [];

for (const sheet of workbook.sheets) {
  if (normalize(sheet.name) === "PLANILHA1") continue;
  const headerIndex = sheet.values.findIndex((row) => row.some((value) => normalize(value) === "SKU") && row.some((value) => normalize(value) === "PRODUTO"));
  if (headerIndex < 0) {
    issues.push({ sheet: sheet.name, row: null, sku: null, code: "HEADER_NOT_FOUND", detail: "Cabeçalhos SKU/PRODUTO não encontrados." });
    continue;
  }
  const indexes = indexesFor(sheet.values[headerIndex]);
  suppliers.push(sheet.name);
  for (let rowIndex = headerIndex + 1; rowIndex < sheet.values.length; rowIndex += 1) {
    const row = sheet.values[rowIndex];
    const sku = skuText(row[indexes.sku]);
    const name = text(row[indexes.name]).replace(/\s*\*\s*$/, "").trim();
    if (!sku && !name) continue;
    if (!sku || !name) {
      issues.push({ sheet: sheet.name, row: rowIndex + 1, sku: sku || null, code: "MISSING_IDENTITY", detail: "SKU ou produto ausente.", raw: row });
      continue;
    }
    const fiscalRaw = normalize(row[indexes.fiscalRule]);
    const fiscalRule = ruleMap.get(fiscalRaw);
    if (!fiscalRule) {
      issues.push({ sheet: sheet.name, row: rowIndex + 1, sku, code: "UNKNOWN_FISCAL_RULE", detail: `Regra fiscal não reconhecida: ${text(row[indexes.fiscalRule])}`, raw: row });
      continue;
    }
    const product = {
      sourceSheet: sheet.name,
      sourceRow: rowIndex + 1,
      supplierName: sheet.name,
      sku,
      manufacturerCode: text(row[indexes.manufacturerCode]) || null,
      name,
      cost: decimal(row[indexes.cost]),
      fiscalRule,
      stAmount: decimal(row[indexes.st]),
      inputIcmsRate: decimal(row[indexes.inputIcms]),
      inputPisRate: decimal(row[indexes.inputPis]),
      inputCofinsRate: decimal(row[indexes.inputCofins]),
      inputIpiRate: decimal(row[indexes.inputIpi]),
      outputIcmsSpRate: decimal(row[indexes.outputSp]),
      outputIcmsSouthSoutheastRate: decimal(row[indexes.outputSs]),
      outputIcmsNorthNortheastRate: decimal(row[indexes.outputNn]),
      marketplace: {
        MERCADO_LIVRE: {
          listingType: "CLASSICO",
          currentSalePrice: positive(row[indexes.mlPrice]) ? decimal(row[indexes.mlPrice]) : null,
          commissionRateOverride: positive(row[indexes.mlCommission]) ? decimal(row[indexes.mlCommission]) : null,
          fixedFeeOverride: null,
          freightCost: positive(row[indexes.mlFreight]) ? decimal(row[indexes.mlFreight]) : "0",
        },
        SHOPEE: {
          listingType: "PADRAO",
          currentSalePrice: positive(row[indexes.shopeePrice]) ? decimal(row[indexes.shopeePrice]) : null,
          commissionRateOverride: null,
          fixedFeeOverride: null,
          freightCost: "0",
        },
        AMAZON: {
          listingType: "PADRAO",
          currentSalePrice: positive(row[indexes.amazonPrice]) ? decimal(row[indexes.amazonPrice]) : null,
          commissionRateOverride: positive(row[indexes.amazonCommission]) ? decimal(row[indexes.amazonCommission]) : null,
          fixedFeeOverride: null,
          freightCost: positive(row[indexes.amazonFreight]) ? decimal(row[indexes.amazonFreight]) : "0",
        },
      },
    };
    if (Number(product.cost) < 0) issues.push({ sheet: sheet.name, row: rowIndex + 1, sku, code: "NEGATIVE_COST", detail: `Custo ${product.cost}` });
    if (product.fiscalRule.endsWith("_ST") && !positive(product.stAmount)) issues.push({ sheet: sheet.name, row: rowIndex + 1, sku, code: "ST_WITHOUT_VALUE", detail: "Regra ST com valor de ST zerado ou ausente." });
    products.push(product);
  }
}

const bySku = new Map();
for (const product of products) bySku.set(product.sku, [...(bySku.get(product.sku) ?? []), product]);
const duplicateSkus = [...bySku.entries()].filter(([, rows]) => rows.length > 1);
for (const [sku, rows] of duplicateSkus) issues.push({
  sheet: [...new Set(rows.map((row) => row.sourceSheet))].join(", "),
  row: null,
  sku,
  code: "DUPLICATE_SKU",
  detail: `${rows.length} ocorrências; nenhuma será escolhida silenciosamente.`,
  candidates: rows,
});

const duplicateSet = new Set(duplicateSkus.map(([sku]) => sku));
const importableProducts = products.filter((product) => !duplicateSet.has(product.sku));
const report = {
  suppliers: suppliers.length,
  parsedProducts: products.length,
  importableProducts: importableProducts.length,
  duplicateSkus: duplicateSkus.length,
  issuesByCode: Object.fromEntries([...new Set(issues.map((issue) => issue.code))].sort().map((code) => [code, issues.filter((issue) => issue.code === code).length])),
  fiscalRules: Object.fromEntries([...new Set(products.map((product) => product.fiscalRule))].sort().map((rule) => [rule, products.filter((product) => product.fiscalRule === rule).length])),
  marketplaceConfigs: Object.fromEntries(["MERCADO_LIVRE", "SHOPEE", "AMAZON"].map((marketplace) => [marketplace, importableProducts.filter((product) => product.marketplace[marketplace].currentSalePrice !== null).length])),
};

await fs.writeFile(".analysis/master-catalog.json", JSON.stringify({ suppliers, products: importableProducts, issues, report }, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
