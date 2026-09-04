"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { deleteProduct } from "@/app/cadastros/actions";

export type ProductFiscalRule = {
  id: string; name: string; has_st: boolean;
  output_icms_sp_rate: number; output_icms_south_southeast_rate: number; output_icms_north_northeast_rate: number;
};
type Supplier = { id: string; name: string };
type Product = { id: string; sku: string; manufacturer_code: string | null; name: string; supplier_id: string; fiscal_rule_id: string; cost: number; st_amount: number | null; active: boolean; input_icms_rate: number; input_pis_rate: number; input_cofins_rate: number; input_ipi_rate: number; has_fixed_price: boolean; fixed_price: number | null; package_weight_kg: number | null; package_height_cm: number | null; package_width_cm: number | null; package_length_cm: number | null; cubic_weight_kg: number | null };
export type ProductMarketplaceRates = { mlClassic: number | null; mlPremium: number | null; amazon: number | null };

const inputFields = [
  ["inputIcmsRate", "ICMS entrada", "input_icms_rate"], ["inputPisRate", "PIS entrada", "input_pis_rate"],
  ["inputCofinsRate", "COFINS entrada", "input_cofins_rate"], ["inputIpiRate", "IPI entrada", "input_ipi_rate"],
] as const;
const outputDetails = [
  ["output_icms_sp_rate", "ICMS saída SP"],
  ["output_icms_south_southeast_rate", "ICMS saída Sul/Sudeste"], ["output_icms_north_northeast_rate", "ICMS saída Norte/Nordeste"],
] as const;

export function ProductForm({ action, suppliers, rules, product, marketplaceRates, error, success, isAdmin = false }: { action: (formData: FormData) => void | Promise<void>; suppliers: Supplier[]; rules: ProductFiscalRule[]; product?: Product; marketplaceRates?: ProductMarketplaceRates; error?: string; success?: string; isAdmin?: boolean }) {
  const [ruleId, setRuleId] = useState(product?.fiscal_rule_id ?? "");
  const [hasFixedPrice, setHasFixedPrice] = useState(product?.has_fixed_price ?? false);
  const [packaging, setPackaging] = useState({ weight: String(product?.package_weight_kg ?? ""), height: String(product?.package_height_cm ?? ""), width: String(product?.package_width_cm ?? ""), length: String(product?.package_length_cm ?? "") });
  const [showSuccess, setShowSuccess] = useState(Boolean(success));
  useEffect(() => {
    if (!success) return;
    const timeout = window.setTimeout(() => setShowSuccess(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [success]);
  const selectedRule = rules.find((rule) => rule.id === ruleId);
  const cubicWeight = [packaging.height, packaging.width, packaging.length].every((item) => Number(item) > 0) ? Number(packaging.height) * Number(packaging.width) * Number(packaging.length) / 6000 : null;
  return <section className="wide-card form-card">{error && <div className="form-error">{error}</div>}{showSuccess && <div className="form-success product-save-success" role="status">{success}</div>}<form action={action} className="entity-form form-grid">
    {product && <input type="hidden" name="id" value={product.id} />}
    <label><span>SKU</span><input name="sku" defaultValue={product?.sku ?? ""} required /></label>
    <label><span>Código do fornecedor</span><input name="manufacturerCode" defaultValue={product?.manufacturer_code ?? ""} /></label>
    <label className="full"><span>Nome do produto</span><input name="name" defaultValue={product?.name ?? ""} required /></label>
    <label><span>Fornecedor</span><select name="supplierId" defaultValue={product?.supplier_id ?? ""} required><option value="">Selecione</option>{suppliers.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
    <label><span>Regra fiscal</span><select name="fiscalRuleId" value={ruleId} onChange={(event) => setRuleId(event.target.value)} required><option value="">Selecione</option>{rules.map((item) => <option value={item.id} key={item.id}>{item.name}{item.has_st ? " · com ST" : ""}</option>)}</select></label>
    <label><span>Custo</span><input name="cost" type="number" min="0" step="0.000001" defaultValue={product?.cost ?? ""} required /></label>
    {selectedRule?.has_st ? <label><span>Valor de ST</span><input name="stAmount" type="number" min="0" step="0.000001" defaultValue={product?.st_amount ?? 0} /></label> : <input type="hidden" name="stAmount" value="0" />}
    {product && <label><span>Status</span><select name="active" defaultValue={String(product.active)}><option value="true">Ativo</option><option value="false">Extinto</option></select></label>}
    <div className="form-section-title full"><strong>Preço tabelado</strong><small>Sinalize quando houver um preço final indicado para os marketplaces.</small></div>
    <label><span>Este produto tem preço tabelado?</span><select name="hasFixedPrice" value={String(hasFixedPrice)} onChange={(event) => setHasFixedPrice(event.target.value === "true")}><option value="false">Não</option><option value="true">Sim</option></select></label>
    {hasFixedPrice && <label><span>Preço tabelado indicado</span><input name="fixedPrice" type="number" min="0.01" step="0.01" defaultValue={product?.fixed_price ?? ""} required /></label>}
    <div className="form-section-title full"><strong>Embalagem e frete</strong><small>Campos opcionais. Se preencher um, informe todos. Mercado Livre e Amazon usam o maior valor entre peso real e peso cubado.</small></div>
    <label><span>Peso real (kg)</span><input name="packageWeightKg" type="number" min="0.0001" step="0.0001" value={packaging.weight} onChange={(event) => setPackaging((current) => ({ ...current, weight: event.target.value }))} /></label>
    <label><span>Altura (cm)</span><input name="packageHeightCm" type="number" min="0.01" step="0.01" value={packaging.height} onChange={(event) => setPackaging((current) => ({ ...current, height: event.target.value }))} /></label>
    <label><span>Largura (cm)</span><input name="packageWidthCm" type="number" min="0.01" step="0.01" value={packaging.width} onChange={(event) => setPackaging((current) => ({ ...current, width: event.target.value }))} /></label>
    <label><span>Comprimento (cm)</span><input name="packageLengthCm" type="number" min="0.01" step="0.01" value={packaging.length} onChange={(event) => setPackaging((current) => ({ ...current, length: event.target.value }))} /></label>
    <label className="full"><span>Cubagem / peso cubado (kg)</span><input value={cubicWeight == null ? "Preencha as três dimensões" : cubicWeight.toLocaleString("pt-BR", { maximumFractionDigits: 6 })} readOnly /></label>
    <div className="form-section-title full"><strong>Impostos de entrada do produto</strong><small>Preencha os percentuais individuais conforme a nota de entrada. Exemplo: 1,65 para 1,65%.</small></div>
    {inputFields.map(([name, label, key]) => <label key={name}><span>{label} (%)</span><input name={name} type="number" min="0" max="100" step="0.0001" defaultValue={product ? Number(product[key]) * 100 : undefined} required /></label>)}
    <div className="form-section-title full"><strong>Taxas específicas por marketplace</strong><small>Informe as taxas da categoria deste produto. Exemplo: 11,5 para 11,5%.</small></div>
    <label><span>Taxa ML Clássico (%)</span><input name="mlClassicRate" type="number" min="0" max="100" step="0.0001" defaultValue={marketplaceRates?.mlClassic != null ? marketplaceRates.mlClassic * 100 : undefined} required /></label>
    <label><span>Taxa ML Premium (%)</span><input name="mlPremiumRate" type="number" min="0" max="100" step="0.0001" defaultValue={marketplaceRates?.mlPremium != null ? marketplaceRates.mlPremium * 100 : undefined} required /></label>
    <label><span>Taxa Tarifa Amazon (%)</span><input name="amazonRate" type="number" min="0" max="100" step="0.0001" defaultValue={marketplaceRates?.amazon != null ? marketplaceRates.amazon * 100 : undefined} required /></label>
    {selectedRule && <><div className="form-section-title full"><strong>ICMS de saída da regra fiscal</strong><small>Preenchidos automaticamente conforme a regra selecionada.</small></div>{outputDetails.map(([key, label]) => <label key={key}><span>{label}</span><input value={`${(Number(selectedRule[key]) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`} readOnly /></label>)}</>}
    <div className="form-actions full">{product && <Link className="secondary-button" href={`/produtos/${product.id}/historico`}>Histórico de custo</Link>}<Link className="secondary-button" href="/produtos">Cancelar</Link><button className="primary-button" type="submit">{product ? "Salvar alterações" : "Salvar produto"}</button></div>
  </form>{product && isAdmin && <form action={deleteProduct} className="danger-zone" onSubmit={(event) => { if (!window.confirm(`Excluir definitivamente o produto ${product.sku}? Esta ação não pode ser desfeita.`)) event.preventDefault(); }}><input type="hidden" name="id" value={product.id} /><div><strong>Excluir produto</strong><p>Remove definitivamente o produto e seus dados relacionados.</p></div><button className="danger-button" type="submit">Excluir produto</button></form>}</section>;
}
