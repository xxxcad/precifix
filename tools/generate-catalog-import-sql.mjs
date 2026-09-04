import { createHash } from "node:crypto";
import fs from "node:fs/promises";

const SOURCE_FILE = "PLANILHA PRECIFICAÇÃO POR FABRICANTE.xlsx";
const IMPORTER_VERSION = "master-catalog-v1";
const catalog = JSON.parse(await fs.readFile(".analysis/master-catalog.json", "utf8"));
const sourceBytes = await fs.readFile(SOURCE_FILE);
const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");

const jsonLiteral = (value, tag) => {
  const serialized = JSON.stringify(value);
  if (serialized.includes(`$${tag}$`)) throw new Error(`Conteúdo incompatível com delimitador ${tag}`);
  return `$${tag}$${serialized}$${tag}$::jsonb`;
};

const suppliers = catalog.suppliers.map((name) => ({ name }));
const products = catalog.products.map((product) => ({
  supplierName: product.supplierName,
  fiscalRule: product.fiscalRule,
  sku: product.sku,
  manufacturerCode: product.manufacturerCode,
  name: product.name,
  cost: product.cost,
  stAmount: product.stAmount,
  inputIcmsRate: product.inputIcmsRate,
  inputPisRate: product.inputPisRate,
  inputCofinsRate: product.inputCofinsRate,
  inputIpiRate: product.inputIpiRate,
  outputIcmsSpRate: product.outputIcmsSpRate,
  outputIcmsSouthSoutheastRate: product.outputIcmsSouthSoutheastRate,
  outputIcmsNorthNortheastRate: product.outputIcmsNorthNortheastRate,
  sourceSheet: product.sourceSheet,
  sourceRow: product.sourceRow,
}));
const configs = catalog.products.flatMap((product) => Object.entries(product.marketplace).map(([marketplaceCode, config]) => ({
  sku: product.sku,
  marketplaceCode,
  ...config,
})));
const issues = catalog.issues.map((issue) => ({
  sourceSheet: issue.sheet,
  sourceRow: issue.row,
  sku: issue.sku,
  code: issue.code,
  detail: issue.detail,
  rawData: issue.raw ? { row: issue.raw } : issue.candidates ? { candidates: issue.candidates } : null,
}));

const status = issues.some((issue) => issue.code !== "MISSING_IDENTITY") ? "PARTIAL" : "IMPORTED";
const batchSelector = `select id from public.catalog_import_batches where source_sha256 = '${sourceSha256}' and importer_version = '${IMPORTER_VERSION}'`;

const sql = `begin;

insert into public.catalog_import_batches(source_file, source_sha256, importer_version, status, summary)
values ('${SOURCE_FILE}', '${sourceSha256}', '${IMPORTER_VERSION}', 'STAGED', ${jsonLiteral(catalog.report, "summary")})
on conflict (source_sha256, importer_version) do update
set source_file = excluded.source_file, status = 'STAGED', summary = excluded.summary, completed_at = null;

with data as (
  select * from jsonb_to_recordset(${jsonLiteral(suppliers, "suppliers")}) as x(name text)
)
insert into public.suppliers(name)
select name from data
on conflict (normalized_name) do update set name = excluded.name, active = true, updated_at = now();

with data as (
  select * from jsonb_to_recordset(${jsonLiteral(products, "products")}) as x(
    "supplierName" text, "fiscalRule" text, sku text, "manufacturerCode" text, name text,
    cost numeric, "stAmount" numeric, "inputIcmsRate" numeric, "inputPisRate" numeric,
    "inputCofinsRate" numeric, "inputIpiRate" numeric, "outputIcmsSpRate" numeric,
    "outputIcmsSouthSoutheastRate" numeric, "outputIcmsNorthNortheastRate" numeric,
    "sourceSheet" text, "sourceRow" integer
  )
)
insert into public.products(
  supplier_id, fiscal_rule_id, sku, manufacturer_code, name, cost, st_amount,
  input_icms_rate, input_pis_rate, input_cofins_rate, input_ipi_rate,
  output_icms_sp_rate, output_icms_south_southeast_rate, output_icms_north_northeast_rate
)
select s.id, f.id, d.sku, d."manufacturerCode", d.name, d.cost, d."stAmount",
  d."inputIcmsRate", d."inputPisRate", d."inputCofinsRate", d."inputIpiRate",
  d."outputIcmsSpRate", d."outputIcmsSouthSoutheastRate", d."outputIcmsNorthNortheastRate"
from data d
join public.suppliers s on s.normalized_name = lower(trim(d."supplierName"))
join public.fiscal_rules f on f.code = d."fiscalRule"
on conflict (sku) do update set
  supplier_id = excluded.supplier_id, fiscal_rule_id = excluded.fiscal_rule_id,
  manufacturer_code = excluded.manufacturer_code, name = excluded.name, cost = excluded.cost,
  st_amount = excluded.st_amount, input_icms_rate = excluded.input_icms_rate,
  input_pis_rate = excluded.input_pis_rate, input_cofins_rate = excluded.input_cofins_rate,
  input_ipi_rate = excluded.input_ipi_rate, output_icms_sp_rate = excluded.output_icms_sp_rate,
  output_icms_south_southeast_rate = excluded.output_icms_south_southeast_rate,
  output_icms_north_northeast_rate = excluded.output_icms_north_northeast_rate,
  active = true, updated_at = now();

with data as (
  select * from jsonb_to_recordset(${jsonLiteral(products, "sources")}) as x(
    sku text, "sourceSheet" text, "sourceRow" integer, "supplierName" text,
    "fiscalRule" text, "manufacturerCode" text, name text, cost numeric,
    "stAmount" numeric, "inputIcmsRate" numeric, "inputPisRate" numeric,
    "inputCofinsRate" numeric, "inputIpiRate" numeric, "outputIcmsSpRate" numeric,
    "outputIcmsSouthSoutheastRate" numeric, "outputIcmsNorthNortheastRate" numeric
  )
), batch as (${batchSelector})
insert into public.product_sources(product_id, import_batch_id, source_sheet, source_row, source_payload)
select p.id, b.id, d."sourceSheet", d."sourceRow", to_jsonb(d)
from data d join public.products p on p.sku = d.sku cross join batch b
on conflict (import_batch_id, source_sheet, source_row) do update
set product_id = excluded.product_id, source_payload = excluded.source_payload, imported_at = now();

with data as (
  select * from jsonb_to_recordset(${jsonLiteral(configs, "configs")}) as x(
    sku text, "marketplaceCode" text, "listingType" text, "currentSalePrice" numeric,
    "commissionRateOverride" numeric, "fixedFeeOverride" numeric, "freightCost" numeric
  )
)
insert into public.product_marketplace_configs(
  product_id, marketplace_id, listing_type, current_sale_price,
  commission_rate_override, fixed_fee_override, freight_cost
)
select p.id, m.id, d."listingType", d."currentSalePrice",
  d."commissionRateOverride", d."fixedFeeOverride", d."freightCost"
from data d
join public.products p on p.sku = d.sku
join public.marketplaces m on m.code = d."marketplaceCode"
on conflict (product_id, marketplace_id, listing_type) do update set
  current_sale_price = excluded.current_sale_price,
  commission_rate_override = excluded.commission_rate_override,
  fixed_fee_override = excluded.fixed_fee_override,
  freight_cost = excluded.freight_cost,
  active = true, updated_at = now();

delete from public.catalog_import_issues
where import_batch_id = (${batchSelector}) and status = 'OPEN';

with data as (
  select * from jsonb_to_recordset(${jsonLiteral(issues, "issues")}) as x(
    "sourceSheet" text, "sourceRow" integer, sku text, code text, detail text, "rawData" jsonb
  )
), batch as (${batchSelector})
insert into public.catalog_import_issues(import_batch_id, source_sheet, source_row, sku, code, detail, raw_data)
select b.id, d."sourceSheet", d."sourceRow", d.sku, d.code, d.detail, d."rawData"
from data d cross join batch b;

update public.catalog_import_batches
set status = '${status}', completed_at = now()
where source_sha256 = '${sourceSha256}' and importer_version = '${IMPORTER_VERSION}';

commit;`;

await fs.writeFile(".analysis/catalog-import.sql", sql, "utf8");
console.log(JSON.stringify({ sourceSha256, importerVersion: IMPORTER_VERSION, suppliers: suppliers.length, products: products.length, configs: configs.length, issues: issues.length, status }, null, 2));
