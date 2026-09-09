export type RepricingTypeLabel = "Custo" | "Preço tabelado" | "Fiscal" | "Comissão/Tarifa" | "Frete/Embalagem" | "Cadastro/Status" | "Outros";

export function repricingTypeLabel(sourceType: string): RepricingTypeLabel {
  if (sourceType === "PRODUCT_COST_CHANGE") return "Custo";
  if (sourceType === "PRODUCT_FIXED_PRICE_CHANGE") return "Preço tabelado";
  if (["PRODUCT_FISCAL_RULE_CHANGE", "PRODUCT_TAX_CHANGE", "FISCAL_RULE_CHANGE"].includes(sourceType)) return "Fiscal";
  if (["PRODUCT_MARKETPLACE_COMMISSION_CHANGE", "PRODUCT_MARKETPLACE_FIXED_FEE_CHANGE", "PRODUCT_MARKETPLACE_LISTING_CHANGE", "MARKETPLACE_CHANGE", "MARKETPLACE_FEE_BAND_CHANGE", "MARKETPLACE_FEE_RULE_CHANGE"].includes(sourceType)) return "Comissão/Tarifa";
  if (["PRODUCT_MARKETPLACE_FREIGHT_CHANGE", "PRODUCT_PACKAGING_CHANGE", "MARKETPLACE_SHIPPING_RULE"].includes(sourceType)) return "Frete/Embalagem";
  if (["PRODUCT_CHANGE", "PRODUCT_MARKETPLACE_CHANGE"].includes(sourceType)) return "Cadastro/Status";
  return "Outros";
}
