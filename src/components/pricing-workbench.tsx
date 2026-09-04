"use client";

import { useCallback, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { ArrowDown, BarChart3, Check, ChevronDown, ChevronUp, GitCompareArrows, Info, Pencil, Save, Search, Sparkles, X } from "lucide-react";
import { calculatePricing, calculateTargetPrice } from "@/domain/pricing/engine";
import type { FiscalRuleKey, MarginClassificationRule, MarketplaceKey, MarketplaceRuleSnapshot, MarketplaceShippingRule, PricingResult, RegionKey, RegionPricingResult, ShippingResolution } from "@/domain/pricing/types";
import { manualShipping, overrideShipping, resolveAmazonShipping, resolveMercadoLivreShipping } from "@/domain/pricing/shipping";
import { marginClassifications, marketplaceNames, products as demoProducts, type DemoProduct } from "@/data/demo-data";
import { resolveMarketplaceRule, type MarketplaceRuleMap } from "@/domain/pricing/marketplace-rules";
import { formatMoney, formatPercent } from "@/lib/format";
import { StatusPill } from "./status-pill";
import { savePricingSnapshot } from "@/app/precificar/actions";
import { MarketplaceBrand } from "./marketplace-brand";

const regionLabels: Record<RegionKey, string> = {
  SP: "São Paulo",
  SUL_SUDESTE: "Sul / Sudeste",
  NORTE_NORDESTE: "Norte / Nordeste",
};

interface SavedPricing {
  id: string;
  createdAt: string;
  sku: string;
  productName: string;
  marketplace: string;
  listingType: string;
  price: string;
  freight: string;
  marginValue: string;
  marginPercent: string;
  snapshot: PricingResult;
  region?: RegionKey;
  rebateType?: "VALUE" | "PERCENT";
  rebateValue?: string;
  appliedRebate?: string;
  practicedRate?: string;
}
export type ManualFiscalRule = { id: string; name: string; code: FiscalRuleKey; has_st: boolean; output_icms_sp_rate: number; output_icms_south_southeast_rate: number; output_icms_north_northeast_rate: number };

type ComparisonScenario = {
  id: "ML_CLASSIC" | "ML_PREMIUM" | "SHOPEE" | "AMAZON";
  marketplace: MarketplaceKey;
  label: string;
  listingType: string;
  isCurrent: boolean;
  salePrice: string;
  result: RegionPricingResult;
  shipping: ShippingResolution;
  feeRate: string;
};

const percentToDecimal = (value: string) => String(Number(value.replace(",", ".")) / 100);
const isValidNumber = (value: string, { positive = false, maximum }: { positive?: boolean; maximum?: number } = {}) => {
  if (value.trim() === "") return false;
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) && (positive ? number > 0 : number >= 0) && (maximum === undefined || number <= maximum);
};

const HISTORY_KEY = "precifix:history:v1";
const HISTORY_EVENT = "precifix:history-updated";
const emptyHistory = "[]";
const subscribeToHistory = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener(HISTORY_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(HISTORY_EVENT, callback);
  };
};
const getHistorySnapshot = () => localStorage.getItem(HISTORY_KEY) ?? emptyHistory;
const getHistoryServerSnapshot = () => emptyHistory;

function solveDynamicTargetPrice({ initialPrice, product, marketplaceRule, classifications, region, targetPercent, rebateType, rebateValue, resolveShipping }: {
  initialPrice: string; product: DemoProduct; marketplaceRule: MarketplaceRuleSnapshot; classifications: MarginClassificationRule[];
  region: RegionKey; targetPercent: string; rebateType: "VALUE" | "PERCENT"; rebateValue: string;
  resolveShipping: (price: string) => ShippingResolution;
}) {
  let candidate = Number(initialPrice) > 0 ? initialPrice : "1";
  const candidates = new Set<number>();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const shippingResolution = resolveShipping(candidate);
    const seed = calculatePricing({ salePrice: candidate, shippingCost: shippingResolution.cost, shippingResolution, marketplaceRebateType: rebateType, marketplaceRebateValue: rebateValue, product, marketplaceRule, classifications });
    const next = calculateTargetPrice(seed.snapshot, region, targetPercent);
    if (Math.abs(Number(next) - Number(candidate)) < 0.005) return next;
    if (candidates.has(Number(next))) return Math.max(...candidates, Number(next)).toFixed(2);
    candidates.add(Number(next));
    candidate = next;
  }
  return candidate;
}

function ComparisonCard({ scenario, mode, targetMargin }: { scenario: ComparisonScenario; mode: "price" | "target"; targetMargin: string }) {
  const tooltipId = `comparison-${scenario.id.toLowerCase()}`;
  const shippingSource = scenario.shipping.source === "AUTOMATIC" ? `Automático · regra v${scenario.shipping.version}` : scenario.shipping.source === "MANUAL_OVERRIDE" ? "Alterado nesta simulação" : "Manual / cadastrado";
  return <button type="button" className={`comparison-card ${scenario.isCurrent ? "current" : ""}`} aria-describedby={tooltipId}>
    <span className="comparison-card-label">{scenario.label}{scenario.isCurrent && <small>Simulação atual</small>}</span>
    <span className="comparison-card-primary">{mode === "target" ? formatMoney(scenario.salePrice) : formatMoney(scenario.result.contributionMarginValue)}</span>
    <span className="comparison-card-secondary">{mode === "target" ? `Meta ${Number(targetMargin.replace(",", ".")).toLocaleString("pt-BR")}%` : formatPercent(scenario.result.contributionMarginPercent)}</span>
    {mode === "price" && <StatusPill classification={scenario.result.classification} />}
    <span className="comparison-tooltip" id={tooltipId} role="tooltip">
      <strong>{scenario.label}</strong>
      <span className="comparison-tooltip-margin"><small>Margem</small><b>{formatMoney(scenario.result.contributionMarginValue)}</b><b>{formatPercent(scenario.result.contributionMarginPercent)}</b></span>
      <span><small>Preço de venda</small><b>{formatMoney(scenario.salePrice)}</b></span>
      <span><small>Comissão ({formatPercent(scenario.feeRate)})</small><b>{formatMoney(scenario.result.marketplacePercentageFee)}</b></span>
      <span><small>Tarifa fixa</small><b>{formatMoney(scenario.result.marketplaceFixedFee)}</b></span>
      <span><small>Rebate aplicado</small><b>{formatMoney(scenario.result.marketplaceRebate)}</b></span>
      <span><small>Frete</small><b>{formatMoney(scenario.result.shippingCost)}</b></span>
      <span className="comparison-tooltip-wide"><small>Origem do frete</small><b>{shippingSource}</b></span>
      {scenario.shipping.billableWeightKg && <span className="comparison-tooltip-wide"><small>Peso considerado</small><b>{scenario.shipping.billableWeightKg} kg · {scenario.shipping.weightBasis === "CUBIC" ? "cubado" : "real"}</b></span>}
      <span><small>ICMS de saída</small><b>{formatMoney(scenario.result.outputIcms)}</b></span>
      <span><small>Custo efetivo</small><b>{formatMoney(scenario.result.effectiveCost)}</b></span>
      <span className="comparison-tooltip-wide"><small>Receita líquida</small><b>{formatMoney(scenario.result.netRevenue)}</b></span>
    </span>
  </button>;
}

function PricingDetailsModal({ item, onClose }: { item: SavedPricing; onClose: () => void }) {
  const selectedRegion = item.region ?? "SP";
  const regional = item.snapshot?.regions?.[selectedRegion];
  const input = item.snapshot?.snapshot;
  const feeBand = item.snapshot?.feeBand;
  const detail = (label: string, value: string) => <div><span>{label}</span><strong>{value}</strong></div>;
  return <div className="pricing-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="pricing-modal" role="dialog" aria-modal="true" aria-labelledby="pricing-details-title">
      <div className="pricing-modal-header"><div><span>Precificação salva</span><h2 id="pricing-details-title">{item.sku} · {item.productName}</h2></div><button type="button" aria-label="Fechar detalhes" onClick={onClose}><X size={20} /></button></div>
      <div className="pricing-detail-grid">
        {detail("Data", new Date(item.createdAt).toLocaleString("pt-BR"))}
        {detail("Marketplace", item.marketplace)}
        {detail("Modalidade", item.listingType === "PREMIUM" ? "Premium" : item.listingType === "CLASSICO" ? "Clássico" : "Padrão")}
        {detail("Região", regionLabels[selectedRegion])}
        {detail("Preço de venda", formatMoney(item.price))}
        {detail("Frete", formatMoney(item.freight))}
        {input?.shippingResolution?.billableWeightKg && detail("Peso considerado", `${input.shippingResolution.billableWeightKg} kg (${input.shippingResolution.weightBasis === "CUBIC" ? "peso cubado" : "peso real"})`)}
        {detail("Taxa praticada", formatPercent(item.practicedRate ?? feeBand?.percentageRate ?? "0"))}
        {detail("Faixa tarifária", feeBand?.label ?? "—")}
        {detail("Rebate informado", Number(item.rebateValue ?? 0) > 0 ? item.rebateType === "PERCENT" ? formatPercent(item.rebateValue ?? "0") : formatMoney(item.rebateValue ?? "0") : "Sem rebate")}
        {detail("Rebate aplicado", formatMoney(item.appliedRebate ?? regional?.marketplaceRebate ?? "0"))}
        {detail("Margem líquida", formatMoney(regional?.contributionMarginValue ?? item.marginValue))}
        {detail("Margem percentual", formatPercent(regional?.contributionMarginPercent ?? item.marginPercent))}
        {detail("Custo do produto", formatMoney(input?.product.cost ?? regional?.productCost ?? "0"))}
        {detail("Custo efetivo", formatMoney(regional?.effectiveCost ?? "0"))}
        {detail("Fornecedor", input?.product.supplierName ?? "—")}
        {detail("Regra fiscal", input?.product.fiscalRule?.replaceAll("_", " ") ?? "—")}
        {detail("ICMS entrada", formatPercent(input?.product.inputIcmsRate ?? "0"))}
        {detail("PIS entrada", formatPercent(input?.product.inputPisRate ?? "0"))}
        {detail("COFINS entrada", formatPercent(input?.product.inputCofinsRate ?? "0"))}
        {detail("IPI entrada", formatPercent(input?.product.inputIpiRate ?? "0"))}
        {detail("Valor ST", formatMoney(input?.product.stAmount ?? "0"))}
        {detail("ICMS saída", formatMoney(regional?.outputIcms ?? "0"))}
        {detail("Comissão", formatMoney(regional?.marketplacePercentageFee ?? "0"))}
        {detail("Tarifa fixa", formatMoney(regional?.marketplaceFixedFee ?? "0"))}
      </div>
      {regional?.breakdown && <div className="pricing-modal-breakdown"><h3>Composição completa</h3>{regional.breakdown.map((line) => <div key={line.key}><span>{line.label}{line.rate && <small>{formatPercent(line.rate)}</small>}</span><strong>{formatMoney(line.value)}</strong></div>)}</div>}
    </section>
  </div>;
}

export function PricingWorkbench({ initialProducts = demoProducts, marketplaceRules = {}, classifications = marginClassifications, fiscalRules = [], shippingRule = null, amazonShippingRule = null }: { initialProducts?: DemoProduct[]; marketplaceRules?: MarketplaceRuleMap; classifications?: MarginClassificationRule[]; fiscalRules?: ManualFiscalRule[]; shippingRule?: MarketplaceShippingRule | null; amazonShippingRule?: MarketplaceShippingRule | null }) {
  const catalogProducts = initialProducts.length ? initialProducts : demoProducts;
  const [productId, setProductId] = useState("");
  const [query, setQuery] = useState("");
  const [productListOpen, setProductListOpen] = useState(false);
  const [marketplace, setMarketplace] = useState<MarketplaceKey>("MERCADO_LIVRE");
  const [premium, setPremium] = useState(false);
  const [salePrice, setSalePrice] = useState("");
  const [shipping, setShipping] = useState("0");
  const [shippingOverridden, setShippingOverridden] = useState(false);
  const [shippingEditing, setShippingEditing] = useState(false);
  const [rebateType, setRebateType] = useState<"VALUE" | "PERCENT">("VALUE");
  const [rebateValue, setRebateValue] = useState("");
  const [region, setRegion] = useState<RegionKey>("SP");
  const [simulationMode, setSimulationMode] = useState<"price" | "target">("price");
  const [targetMargin, setTargetMargin] = useState("10");
  const [saved, setSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [temporaryRates, setTemporaryRates] = useState<Record<string, string>>({});
  const [editableRateKeys, setEditableRateKeys] = useState<Record<string, boolean>>({});
  const [manualMode, setManualMode] = useState(false);
  const [manualCost, setManualCost] = useState("");
  const [manualRuleId, setManualRuleId] = useState(fiscalRules[0]?.id ?? "");
  const [manualInputIcms, setManualInputIcms] = useState("");
  const [manualInputPis, setManualInputPis] = useState("");
  const [manualInputCofins, setManualInputCofins] = useState("");
  const [manualInputIpi, setManualInputIpi] = useState("");
  const [manualStAmount, setManualStAmount] = useState("");
  const [manualPackaging, setManualPackaging] = useState({ weight: "", height: "", width: "", length: "" });
  const [collapsedSteps, setCollapsedSteps] = useState<Record<1 | 2 | 3, boolean>>({ 1: false, 2: false, 3: false });
  const [historyDetails, setHistoryDetails] = useState<SavedPricing | null>(null);
  const [isSaving, startSaving] = useTransition();
  const selectedCatalogProduct = catalogProducts.find((item) => item.productId === productId);
  const catalogProduct = selectedCatalogProduct ?? catalogProducts[0];
  const manualFiscalRule = fiscalRules.find((item) => item.id === manualRuleId) ?? fiscalRules[0];
  const manualHasSt = Boolean(manualFiscalRule?.has_st ?? manualFiscalRule?.code.endsWith("_ST"));
  const manualPackagingValues = Object.values(manualPackaging);
  const manualPackagingStarted = manualPackagingValues.some((value) => value.trim() !== "");
  const manualPackagingComplete = manualPackagingValues.every((value) => isValidNumber(value, { positive: true }));
  const manualCubicWeight = manualPackagingComplete ? String(Number(manualPackaging.height.replace(",", ".")) * Number(manualPackaging.width.replace(",", ".")) * Number(manualPackaging.length.replace(",", ".")) / 6000) : null;
  const manualInputValid = Boolean(manualFiscalRule)
    && isValidNumber(manualCost, { positive: true })
    && [manualInputIcms, manualInputPis, manualInputCofins, manualInputIpi].every((value) => isValidNumber(value, { maximum: 100 }))
    && (!manualHasSt || isValidNumber(manualStAmount))
    && (!manualPackagingStarted || manualPackagingComplete);
  const manualProduct = useMemo<DemoProduct>(() => ({ productId: "manual", sku: "MANUAL", manufacturerCode: "—", productName: "Produto manual", supplierName: "Não aplicável", cost: manualCost || "0", fiscalRule: manualFiscalRule?.code ?? "ISENTO", stAmount: manualHasSt ? manualStAmount || "0" : "0", inputIcmsRate: percentToDecimal(manualInputIcms || "0"), inputPisRate: percentToDecimal(manualInputPis || "0"), inputCofinsRate: percentToDecimal(manualInputCofins || "0"), inputIpiRate: percentToDecimal(manualInputIpi || "0"), outputIcmsRates: { SP: String(manualFiscalRule?.output_icms_sp_rate ?? 0), SUL_SUDESTE: String(manualFiscalRule?.output_icms_south_southeast_rate ?? 0), NORTE_NORDESTE: String(manualFiscalRule?.output_icms_north_northeast_rate ?? 0) }, packageWeightKg: manualPackagingComplete ? manualPackaging.weight.replace(",", ".") : null, packageHeightCm: manualPackagingComplete ? manualPackaging.height.replace(",", ".") : null, packageWidthCm: manualPackagingComplete ? manualPackaging.width.replace(",", ".") : null, packageLengthCm: manualPackagingComplete ? manualPackaging.length.replace(",", ".") : null, cubicWeightKg: manualCubicWeight, marketplace: { MERCADO_LIVRE: { percentageRate: "0.115", premiumPercentageRate: "0.165", freight: "0", currentPrice: "0" }, SHOPEE: { percentageRate: "0.14", freight: "0", currentPrice: "0" }, AMAZON: { percentageRate: "0.12", freight: "0", currentPrice: "0" } }, active: true, hasFixedPrice: false, fixedPrice: null, updatedAt: new Date(0).toISOString() }), [manualCost, manualFiscalRule, manualHasSt, manualStAmount, manualInputIcms, manualInputPis, manualInputCofins, manualInputIpi, manualPackaging, manualPackagingComplete, manualCubicWeight]);
  const product = manualMode ? manualProduct : catalogProduct;
  const hasSelectedProduct = manualMode || Boolean(selectedCatalogProduct);
  const productRule = useMemo(() => resolveMarketplaceRule(product, marketplace, premium, marketplaceRules), [product, marketplace, premium, marketplaceRules]);
  const rateKey = `${product.productId}:${marketplace}:${productRule.listingType}`;
  const storedRatePercent = temporaryRates[rateKey];
  const practicedRatePercent = storedRatePercent ?? String(Math.round(Number(productRule.feeBands[0]?.percentageRate ?? 0) * 1000000) / 10000);
  const rateEditing = Boolean(editableRateKeys[rateKey]);
  const temporaryRateDecimal = Number(practicedRatePercent.replace(",", ".")) / 100;
  const marketplaceRebateValue = rebateType === "PERCENT" ? percentToDecimal(rebateValue || "0") : rebateValue || "0";
  const rule = useMemo(() => Number.isFinite(temporaryRateDecimal) && temporaryRateDecimal >= 0 && temporaryRateDecimal <= 1
    ? { ...productRule, feeBands: productRule.feeBands.map((band) => ({ ...band, percentageRate: String(temporaryRateDecimal) })) }
    : productRule, [productRule, temporaryRateDecimal]);

  const historyJson = useSyncExternalStore(subscribeToHistory, getHistorySnapshot, getHistoryServerSnapshot);
  const history = useMemo<SavedPricing[]>(() => {
    try { return JSON.parse(historyJson); }
    catch { return []; }
  }, [historyJson]);

  const resolveShipping = useCallback((price: string): ShippingResolution => {
    if (!rule.shippingRequired) return manualShipping("0");
    if (marketplace === "MERCADO_LIVRE" && product.packageWeightKg && product.cubicWeightKg && shippingRule) {
      const automatic = resolveMercadoLivreShipping(price, product.packageWeightKg, product.cubicWeightKg, shippingRule);
      return shippingOverridden ? overrideShipping(automatic, shipping) : automatic;
    }
    if (marketplace === "AMAZON" && product.packageWeightKg && product.cubicWeightKg && amazonShippingRule) {
      const automatic = resolveAmazonShipping(price, product.packageWeightKg, product.cubicWeightKg, amazonShippingRule);
      return shippingOverridden ? overrideShipping(automatic, shipping) : automatic;
    }
    return manualShipping(shipping);
  }, [rule.shippingRequired, marketplace, product.packageWeightKg, product.cubicWeightKg, shippingRule, amazonShippingRule, shippingOverridden, shipping]);

  const targetSalePrice = useMemo(() => {
    if (simulationMode !== "target") return null;
    if (!hasSelectedProduct || (manualMode && !manualInputValid)) return null;
    try {
      return solveDynamicTargetPrice({ initialPrice: salePrice, product, marketplaceRule: rule, classifications, region, targetPercent: String(Number(targetMargin.replace(",", ".")) / 100), rebateType, rebateValue: marketplaceRebateValue, resolveShipping });
    } catch { return null; }
  }, [simulationMode, salePrice, marketplaceRebateValue, rebateType, product, rule, classifications, region, targetMargin, hasSelectedProduct, manualMode, manualInputValid, resolveShipping]);
  const effectiveSalePrice = simulationMode === "target" ? targetSalePrice ?? "0" : salePrice;
  const shippingResolution = useMemo(() => {
    try { return resolveShipping(effectiveSalePrice); }
    catch { return manualShipping(shipping); }
  }, [effectiveSalePrice, shipping, resolveShipping]);
  const automaticShippingAvailable = Boolean(product.packageWeightKg && product.cubicWeightKg && ((marketplace === "MERCADO_LIVRE" && shippingRule) || (marketplace === "AMAZON" && amazonShippingRule)));
  const freightRequiresUnlock = (hasSelectedProduct && !manualMode) || (manualMode && automaticShippingAvailable);
  const result = useMemo(() => {
    if (!hasSelectedProduct || (manualMode && !manualInputValid)) return null;
    try {
      return calculatePricing({ salePrice: effectiveSalePrice, shippingCost: shippingResolution.cost, shippingResolution, marketplaceRebateType: rebateType, marketplaceRebateValue, product, marketplaceRule: rule, classifications });
    } catch { return null; }
  }, [product, rule, effectiveSalePrice, shippingResolution, marketplaceRebateValue, rebateType, classifications, hasSelectedProduct, manualMode, manualInputValid]);

  const productHistory = hasSelectedProduct ? history.filter((item) => item.sku === product.sku).slice(0, 4) : [];
  const selected = result?.regions[region];
  const marginMeterPosition = selected ? Math.max(0, Math.min(100, Number(selected.contributionMarginPercent) / 0.15 * 100)) : 0;
  const marginMeterDetails = selected ? `${regionLabels[region]}: margem de ${formatMoney(selected.contributionMarginValue)} (${formatPercent(selected.contributionMarginPercent)}) sobre o preço simulado de ${formatMoney(selected.salePrice)}.` : "";
  const suggestions = catalogProducts.filter((item) => `${item.sku} ${item.manufacturerCode} ${item.productName}`.toLowerCase().includes(query.toLowerCase())).slice(0, 5);

  function updateManualPackaging(field: keyof typeof manualPackaging, input: string) {
    setManualPackaging((current) => ({ ...current, [field]: input.replace(",", ".") }));
    setShippingOverridden(false);
    setShippingEditing(false);
  }

  function toggleStep(step: 1 | 2 | 3) {
    setCollapsedSteps((current) => ({ ...current, [step]: !current[step] }));
  }

  function chooseProduct(nextId: string) {
    const next = catalogProducts.find((item) => item.productId === nextId);
    if (!next) return;
    setProductId(next.productId);
    setQuery(`${next.sku} · ${next.productName}`);
    setProductListOpen(false);
    setSalePrice(next.marketplace[marketplace].currentPrice);
    setShipping(next.marketplace[marketplace].freight);
    setShippingOverridden(false);
    setShippingEditing(false);
    setEditableRateKeys({});
    setRebateValue("");
  }

  function chooseMarketplace(next: MarketplaceKey) {
    setMarketplace(next);
    setPremium(false);
    const selectedProduct = manualMode ? manualProduct : selectedCatalogProduct;
    setSalePrice(selectedProduct?.marketplace[next].currentPrice ?? "");
    setShipping(selectedProduct?.marketplace[next].freight ?? "0");
    setShippingOverridden(false);
    setShippingEditing(false);
    setEditableRateKeys({});
    setRebateValue("");
  }

  function savePricing() {
    if (!result || !selected) return;
    const entry: SavedPricing = {
      id: crypto.randomUUID(), createdAt: new Date().toISOString(), sku: product.sku,
      productName: product.productName, marketplace: marketplaceNames[marketplace], listingType: rule.listingType,
      price: effectiveSalePrice, freight: shippingResolution.cost,
      marginValue: selected.contributionMarginValue, marginPercent: selected.contributionMarginPercent, snapshot: result,
      region, rebateType, rebateValue: marketplaceRebateValue, appliedRebate: selected.marketplaceRebate,
      practicedRate: result.feeBand.percentageRate,
    };
    const next = [entry, ...history].slice(0, 50);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(HISTORY_EVENT));
    if (manualMode) {
      setSaveMessage("Simulação manual mantida somente neste navegador.");
      setSaved(true);
      window.setTimeout(() => { setSaved(false); setSaveMessage(""); }, 2600);
      return;
    }
    startSaving(async () => {
      const outcome = await savePricingSnapshot({ productId: product.productId, marketplace, listingType: rule.listingType, region, salePrice: effectiveSalePrice, shippingCost: shippingResolution.cost, shippingResolution, rebateType, rebateValue: marketplaceRebateValue, temporaryRate: marketplace === "SHOPEE" ? undefined : rule.feeBands[0]?.percentageRate });
      setSaveMessage(outcome.message);
      setSaved(true);
      window.setTimeout(() => { setSaved(false); setSaveMessage(""); }, 2600);
    });
  }

  const targetPrices = result ? [
    ["Equilíbrio", "0"], ["Aceitável", "0.09"], ["OK", "0.10"], ["Meta 15%", "0.15"],
  ].map(([label, target]) => ({ label, value: calculateTargetPrice(result.snapshot, region, target) })) : [];
  const scenarios = result ? ["-0.10", "-0.05", "0", "0.05", "0.10"].map((variation) => {
    const price = Number(effectiveSalePrice) * (1 + Number(variation));
    const scenarioShipping = resolveShipping(price.toFixed(2));
    const scenario = calculatePricing({ ...result.snapshot, salePrice: price.toFixed(2), shippingCost: scenarioShipping.cost, shippingResolution: scenarioShipping }).regions[region];
    return { variation, price: price.toFixed(2), margin: scenario.contributionMarginPercent };
  }) : [];
  const marketplaceComparison = useMemo<ComparisonScenario[]>(() => {
    if (!result) return [];
    const scenarioDefinitions = [
      { id: "ML_CLASSIC", marketplace: "MERCADO_LIVRE", premium: false, label: "Clássico" },
      { id: "ML_PREMIUM", marketplace: "MERCADO_LIVRE", premium: true, label: "Premium" },
      { id: "SHOPEE", marketplace: "SHOPEE", premium: false, label: "Shopee" },
      { id: "AMAZON", marketplace: "AMAZON", premium: false, label: "Amazon" },
    ] as const;
    return scenarioDefinitions.flatMap((definition) => {
      try {
        const isCurrent = marketplace === definition.marketplace && (definition.marketplace !== "MERCADO_LIVRE" || premium === definition.premium);
        const scenarioRule = isCurrent ? rule : resolveMarketplaceRule(product, definition.marketplace, definition.premium, marketplaceRules);
        const scenarioRebateType = isCurrent ? rebateType : "VALUE" as const;
        const scenarioRebateValue = isCurrent ? marketplaceRebateValue : "0";
        const resolveScenarioShipping = (price: string) => {
          if (!scenarioRule.shippingRequired) return manualShipping("0");
          if (definition.marketplace === "MERCADO_LIVRE" && product.packageWeightKg && product.cubicWeightKg && shippingRule) {
            const automatic = resolveMercadoLivreShipping(price, product.packageWeightKg, product.cubicWeightKg, shippingRule);
            return isCurrent && shippingOverridden ? overrideShipping(automatic, shipping) : automatic;
          }
          if (definition.marketplace === "AMAZON" && product.packageWeightKg && product.cubicWeightKg && amazonShippingRule) {
            const automatic = resolveAmazonShipping(price, product.packageWeightKg, product.cubicWeightKg, amazonShippingRule);
            return isCurrent && shippingOverridden ? overrideShipping(automatic, shipping) : automatic;
          }
          return manualShipping(isCurrent ? shipping : product.marketplace[definition.marketplace].freight);
        };
        const scenarioPrice = simulationMode === "target" ? solveDynamicTargetPrice({
          initialPrice: salePrice || product.marketplace[definition.marketplace].currentPrice,
          product, marketplaceRule: scenarioRule, classifications, region,
          targetPercent: String(Number(targetMargin.replace(",", ".")) / 100),
          rebateType: scenarioRebateType, rebateValue: scenarioRebateValue, resolveShipping: resolveScenarioShipping,
        }) : effectiveSalePrice;
        const scenarioShipping = resolveScenarioShipping(scenarioPrice);
        const scenarioResult = calculatePricing({ salePrice: scenarioPrice, shippingCost: scenarioShipping.cost, shippingResolution: scenarioShipping, marketplaceRebateType: scenarioRebateType, marketplaceRebateValue: scenarioRebateValue, product, marketplaceRule: scenarioRule, classifications }).regions[region];
        return [{ id: definition.id, marketplace: definition.marketplace, label: definition.label, listingType: scenarioRule.listingType, isCurrent, salePrice: scenarioPrice, result: scenarioResult, shipping: scenarioShipping, feeRate: scenarioRule.feeBands.find((band) => Number(scenarioPrice) >= Number(band.minPrice) && (band.maxPrice === null || Number(scenarioPrice) < Number(band.maxPrice)))?.percentageRate ?? scenarioRule.feeBands[0]?.percentageRate ?? "0" }];
      } catch { return []; }
    });
  }, [result, marketplace, premium, rule, product, marketplaceRules, rebateType, marketplaceRebateValue, shippingRule, amazonShippingRule, shippingOverridden, shipping, simulationMode, salePrice, effectiveSalePrice, classifications, region, targetMargin]);

  return (
    <div className="pricing-grid">
      <section className="pricing-input-panel">
        <button type="button" className="step-label step-toggle" aria-expanded={!collapsedSteps[1]} aria-controls="pricing-step-product" onClick={() => toggleStep(1)}><span>1</span><strong>Produto</strong>{collapsedSteps[1] && <small>{manualMode ? `Manual · ${manualCost ? formatMoney(manualCost) : "custo pendente"}` : selectedCatalogProduct ? `${selectedCatalogProduct.sku} · ${selectedCatalogProduct.productName}` : "Não selecionado"}</small>}{collapsedSteps[1] ? <ChevronDown size={17} /> : <ChevronUp size={17} />}</button>
        <div id="pricing-step-product" className="collapsible-step" hidden={collapsedSteps[1]}>
        <button className={`manual-product-toggle ${manualMode ? "selected" : ""}`} type="button" onClick={() => { setManualMode((current) => !current); setSalePrice(""); setShipping("0"); setShippingEditing(false); setShippingOverridden(false); setEditableRateKeys({}); setRebateValue(""); setProductListOpen(false); }}>Produto manual</button>
        {!manualMode ? <div className="search-combobox">
          <Search size={18} />
          <input aria-label="Buscar produto" value={query} onFocus={() => setProductListOpen(true)} onChange={(event) => { setQuery(event.target.value); setProductId(""); setProductListOpen(true); }} placeholder="SKU, código ou nome" />
          <button className="product-list-toggle" type="button" aria-label={productListOpen ? "Fechar lista de produtos" : "Abrir lista de produtos"} aria-expanded={productListOpen} onClick={() => setProductListOpen((current) => !current)}><ChevronDown size={17} /></button>
          {productListOpen && (
            <div className="suggestions">
              {suggestions.map((item) => (
                <button type="button" key={item.productId} onClick={() => chooseProduct(item.productId)}>
                  <span><strong>{item.sku}</strong>{item.productName}</span><small>{item.supplierName} · {item.manufacturerCode}</small>
                </button>
              ))}
            </div>
          )}
        </div> : <div className="manual-product-fields">
          <label><span>Custo do produto</span><div><span>R$</span><input aria-label="Custo do produto manual" inputMode="decimal" value={manualCost} onChange={(event) => setManualCost(event.target.value.replace(",", "."))} placeholder="0,00" /></div></label>
          <label><span>Regra fiscal</span><select aria-label="Regra fiscal do produto manual" value={manualRuleId} onChange={(event) => { setManualRuleId(event.target.value); setManualStAmount(""); }}>{fiscalRules.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label><span>ICMS entrada (%)</span><div><input aria-label="ICMS de entrada do produto manual" inputMode="decimal" value={manualInputIcms} onChange={(event) => setManualInputIcms(event.target.value.replace(",", "."))} placeholder="0,00" /><span>%</span></div></label>
          <label><span>PIS entrada (%)</span><div><input aria-label="PIS de entrada do produto manual" inputMode="decimal" value={manualInputPis} onChange={(event) => setManualInputPis(event.target.value.replace(",", "."))} placeholder="0,00" /><span>%</span></div></label>
          <label><span>COFINS entrada (%)</span><div><input aria-label="COFINS de entrada do produto manual" inputMode="decimal" value={manualInputCofins} onChange={(event) => setManualInputCofins(event.target.value.replace(",", "."))} placeholder="0,00" /><span>%</span></div></label>
          <label><span>IPI entrada (%)</span><div><input aria-label="IPI de entrada do produto manual" inputMode="decimal" value={manualInputIpi} onChange={(event) => setManualInputIpi(event.target.value.replace(",", "."))} placeholder="0,00" /><span>%</span></div></label>
          {manualHasSt && <label><span>Valor do ST</span><div><span>R$</span><input aria-label="Valor do ST do produto manual" inputMode="decimal" value={manualStAmount} onChange={(event) => setManualStAmount(event.target.value.replace(",", "."))} placeholder="0,00" /></div></label>}
          <div className="manual-packaging-title"><strong>Embalagem para cálculo de frete</strong><small>Opcional. Se preencher um campo, informe todos.</small></div>
          <label><span>Peso real (kg)</span><div><input aria-label="Peso real do produto manual" inputMode="decimal" value={manualPackaging.weight} onChange={(event) => updateManualPackaging("weight", event.target.value)} placeholder="0,000" /><span>kg</span></div></label>
          <label><span>Altura (cm)</span><div><input aria-label="Altura da embalagem manual" inputMode="decimal" value={manualPackaging.height} onChange={(event) => updateManualPackaging("height", event.target.value)} placeholder="0,00" /><span>cm</span></div></label>
          <label><span>Largura (cm)</span><div><input aria-label="Largura da embalagem manual" inputMode="decimal" value={manualPackaging.width} onChange={(event) => updateManualPackaging("width", event.target.value)} placeholder="0,00" /><span>cm</span></div></label>
          <label><span>Comprimento (cm)</span><div><input aria-label="Comprimento da embalagem manual" inputMode="decimal" value={manualPackaging.length} onChange={(event) => updateManualPackaging("length", event.target.value)} placeholder="0,00" /><span>cm</span></div></label>
          <label className="manual-cubic-weight"><span>Peso cubado (kg)</span><div><input aria-label="Peso cubado do produto manual" value={manualCubicWeight ? Number(manualCubicWeight).toLocaleString("pt-BR", { maximumFractionDigits: 6 }) : ""} placeholder="Calculado automaticamente" readOnly /><span>kg</span></div></label>
          {!manualInputValid && <p className="manual-product-hint">Preencha o custo e todos os impostos de entrada para calcular.{manualHasSt ? " Informe também o valor do ST." : ""}{manualPackagingStarted && !manualPackagingComplete ? " Complete todos os dados da embalagem ou deixe-os vazios." : ""}</p>}
        </div>}
        {hasSelectedProduct ? <div className="product-context">
          <div><span>Fornecedor</span><strong>{product.supplierName}</strong></div>
          <div><span>Custo</span><strong>{formatMoney(product.cost)}</strong></div>
          <div><span>Regra fiscal</span><strong>{product.fiscalRule.replaceAll("_", " ")}</strong></div>
        </div> : <div className="product-empty-hint">Pesquise ou abra a lista para selecionar um produto.</div>}
        </div>

        <div className="flow-divider"><ArrowDown size={17} /></div>
        <button type="button" className="step-label step-toggle" aria-expanded={!collapsedSteps[2]} aria-controls="pricing-step-marketplace" onClick={() => toggleStep(2)}><span>2</span><strong>Marketplace</strong>{collapsedSteps[2] && <small>{marketplaceNames[marketplace]}{marketplace === "MERCADO_LIVRE" ? premium ? " · Premium" : " · Clássico" : ""}</small>}{collapsedSteps[2] ? <ChevronDown size={17} /> : <ChevronUp size={17} />}</button>
        <div id="pricing-step-marketplace" className="collapsible-step" hidden={collapsedSteps[2]}>
        <div className="marketplace-tabs" role="tablist">
          {(Object.keys(marketplaceNames) as MarketplaceKey[]).map((key) => (
            <button type="button" role="tab" aria-selected={marketplace === key} className={marketplace === key ? "selected" : ""} key={key} onClick={() => chooseMarketplace(key)}><MarketplaceBrand marketplace={key} compact /><span>{marketplaceNames[key]}</span></button>
          ))}
        </div>
        {marketplace === "MERCADO_LIVRE" && (
          <div className="segmented"><button type="button" className={!premium ? "selected" : ""} onClick={() => setPremium(false)}>Clássico</button><button type="button" className={premium ? "selected" : ""} onClick={() => setPremium(true)}>Premium</button></div>
        )}
        {hasSelectedProduct && marketplace !== "SHOPEE" && <label className="marketplace-rate-field"><span>{marketplace === "AMAZON" ? "Taxa Tarifa Amazon praticada" : premium ? "Taxa ML Premium praticada" : "Taxa ML Clássico praticada"}</span><div><input aria-label="Taxa praticada nesta simulação" inputMode="decimal" value={practicedRatePercent} readOnly={!rateEditing} onChange={(event) => setTemporaryRates((current) => ({ ...current, [rateKey]: event.target.value.replace(",", ".") }))} /><span>%</span><button type="button" className={rateEditing ? "field-edit-button active" : "field-edit-button"} aria-label={rateEditing ? "Taxa liberada para simulação" : "Editar taxa nesta simulação"} title="Editar nesta simulação" onClick={() => setEditableRateKeys((current) => ({ ...current, [rateKey]: true }))}><Pencil size={15} /></button></div><small>{rateEditing ? "Edição liberada. A alteração vale somente para esta simulação." : "Herdada do cadastro do produto. Clique no lápis para simular outro valor."}</small></label>}
        </div>

        <div className="flow-divider"><ArrowDown size={17} /></div>
        <button type="button" className="step-label step-toggle" aria-expanded={!collapsedSteps[3]} aria-controls="pricing-step-simulation" onClick={() => toggleStep(3)}><span>3</span><strong>Simulação</strong>{collapsedSteps[3] && <small>{simulationMode === "target" ? `Margem alvo · ${targetMargin || "0"}%` : `Preço · ${salePrice ? formatMoney(salePrice) : "não informado"}`}</small>}{collapsedSteps[3] ? <ChevronDown size={17} /> : <ChevronUp size={17} />}</button>
        <div id="pricing-step-simulation" className="collapsible-step" hidden={collapsedSteps[3]}>
        {hasSelectedProduct && !manualMode && product.hasFixedPrice && product.fixedPrice && <div className="fixed-price-notice"><Info size={18} /><div><strong>Produto com preço tabelado</strong><span>Valor indicado: {formatMoney(product.fixedPrice)}. Você pode simular qualquer outro preço normalmente.</span></div></div>}
        <div className="segmented simulation-mode"><button type="button" className={simulationMode === "price" ? "selected" : ""} onClick={() => setSimulationMode("price")}>Preço de venda / Frete</button><button type="button" className={simulationMode === "target" ? "selected" : ""} onClick={() => setSimulationMode("target")}>Margem alvo</button></div>
        <div className="money-fields">
          {simulationMode === "price" ? <label><span>Preço de venda</span><div><span>R$</span><input inputMode="decimal" value={salePrice} onChange={(event) => setSalePrice(event.target.value.replace(",", "."))} /></div></label> : <label><span>Margem desejada</span><div><input inputMode="decimal" value={targetMargin} onChange={(event) => setTargetMargin(event.target.value.replace(",", "."))} /><span>%</span></div></label>}
          {rule.shippingRequired && <label><span>Frete</span><div><span>R$</span><input aria-label="Frete praticado nesta simulação" inputMode="decimal" value={shippingEditing ? shipping : shippingResolution.cost} readOnly={freightRequiresUnlock && !shippingEditing} onChange={(event) => { setShipping(event.target.value.replace(",", ".")); setShippingOverridden(true); }} />{freightRequiresUnlock && <button type="button" className={shippingEditing ? "field-edit-button active" : "field-edit-button"} aria-label={shippingEditing ? "Frete liberado para simulação" : "Editar frete nesta simulação"} title="Editar nesta simulação" onClick={() => { setShipping(shippingResolution.cost); setShippingEditing(true); }}><Pencil size={15} /></button>}</div>{shippingResolution.source !== "MANUAL" && <small>{shippingResolution.source === "AUTOMATIC" ? "Automático" : "Substituído nesta simulação"} · peso considerado {shippingResolution.billableWeightKg} kg ({shippingResolution.weightBasis === "CUBIC" ? "cubado" : "real"}) · {shippingResolution.weightBandLabel} · {shippingResolution.priceBandLabel} · versão {shippingResolution.version}{shippingOverridden && <button type="button" className="inline-reset" onClick={() => { setShippingOverridden(false); setShippingEditing(false); }}>Usar automático</button>}</small>}{shippingResolution.source === "MANUAL" && freightRequiresUnlock && <small>{shippingEditing ? "Edição liberada. Aceita valores com centavos e vale somente para esta simulação." : "Herdado do cadastro. Clique no lápis para simular outro valor."}</small>}{shippingResolution.source === "MANUAL" && manualMode && !manualPackagingComplete && <small>Frete manual. Preencha a embalagem completa para usar as regras automáticas de Mercado Livre ou Amazon.</small>}</label>}
          <label><span>Rebate da plataforma</span><div className="rebate-field"><select aria-label="Formato do rebate" value={rebateType} onChange={(event) => { setRebateType(event.target.value as "VALUE" | "PERCENT"); setRebateValue(""); }}><option value="VALUE">R$</option><option value="PERCENT">%</option></select><input aria-label="Rebate da plataforma" inputMode="decimal" value={rebateValue} onChange={(event) => setRebateValue(event.target.value.replace(",", "."))} placeholder="0,00" /></div></label>
        </div>
        {simulationMode === "target" && <div className="target-price-result"><span>Preço mínimo necessário</span><strong>{targetSalePrice ? formatMoney(targetSalePrice) : "Margem inviável"}</strong><small>Arredondado para cima para garantir a margem em {regionLabels[region]}.</small></div>}
        <div className="auto-rule"><Sparkles size={16} /><span><strong>Regras resolvidas automaticamente</strong> {result?.feeBand.label} · versão {rule.version}</span></div>
        </div>
      </section>

      <section className="pricing-result-panel" aria-live="polite">
        {selected && result ? (
          <>
            <div className="result-topline"><span>Resultado da simulação</span><span className="live-dot">Tempo real</span></div>
            <div className="region-tabs">
              {(Object.keys(regionLabels) as RegionKey[]).map((key) => <button type="button" key={key} onClick={() => setRegion(key)} className={region === key ? "selected" : ""}>{regionLabels[key]}</button>)}
            </div>
            <div className="hero-result">
              <div><span>Margem líquida</span><strong>{formatMoney(selected.contributionMarginValue)}</strong></div>
              <div><span>Margem de contribuição</span><strong>{formatPercent(selected.contributionMarginPercent)}</strong></div>
              <StatusPill classification={selected.classification} />
            </div>
            <div className="other-region-margins">{(Object.keys(regionLabels) as RegionKey[]).filter((key) => key !== region).map((key) => <button type="button" key={key} onClick={() => setRegion(key)}><span>{regionLabels[key]}</span><strong>{formatMoney(result.regions[key].contributionMarginValue)}</strong><small>{formatPercent(result.regions[key].contributionMarginPercent)}</small></button>)}</div>
            <div className="breakdown-card">
              <div className="card-heading"><div><h2>Composição da margem</h2><p>Valores exatos usados neste cálculo.</p></div><Info size={17} /></div>
              <div className="breakdown-list">
                {selected.breakdown.map((line) => (
                  <div className={line.category === "margin" ? "total" : ""} key={line.key} title={line.explanation}>
                    <span>{line.label}{line.rate && <small>{formatPercent(line.rate)}</small>}</span>
                    <strong className={Number(line.value) < 0 ? "negative" : ""}>{formatMoney(line.value)}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="target-strip">
              {targetPrices.map((target) => <div key={target.label}><span>{target.label}</span><strong>{formatMoney(target.value)}</strong></div>)}
            </div>
            <div className="margin-thermometer" aria-label="Termômetro da margem entre equilíbrio e meta de 15%">
              <div className="margin-thermometer-track"><div className={`margin-thermometer-marker ${marginMeterPosition < 20 ? "near-start" : marginMeterPosition > 80 ? "near-end" : ""}`} tabIndex={0} style={{ left: `${marginMeterPosition}%` }} title={marginMeterDetails} aria-label={marginMeterDetails}><span>{marginMeterDetails}</span></div></div>
              <div className="margin-thermometer-scale"><span>Equilíbrio · 0%</span><span>Meta · 15%</span></div>
            </div>
            <button className="primary-button" type="button" onClick={savePricing} disabled={isSaving}>{saved ? <Check size={18} /> : <Save size={18} />}{isSaving ? "Salvando…" : saved ? "Precificação salva" : "Salvar precificação"}</button>
            {saveMessage && <p className="save-message" role="status">{saveMessage}</p>}
          </>
        ) : <div className="empty-result">{manualMode && !manualInputValid ? "Preencha os dados fiscais do produto manual para calcular." : "Informe um preço válido para calcular."}</div>}
      </section>

      <section className="wide-card">
        <div className="card-heading"><div><h2>Últimas precificações deste produto</h2><p>O snapshot preserva custos, alíquotas e a versão tarifária.</p></div></div>
        {productHistory.length ? (
          <div className="data-table pricing-history"><div className="table-row table-head"><span>Data</span><span>Marketplace</span><span>Preço</span><span>Frete</span><span>Rebate</span><span>Margem</span><span></span></div>{productHistory.map((item) => <div className="table-row" key={item.id}><span>{new Date(item.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span><span>{item.marketplace}{item.marketplace === marketplaceNames.MERCADO_LIVRE && <small>{item.listingType === "PREMIUM" ? "Premium" : "Clássico"}</small>}</span><span>{formatMoney(item.price)}</span><span>{formatMoney(item.freight)}</span><span>{Number(item.appliedRebate ?? 0) > 0 ? formatMoney(item.appliedRebate ?? "0") : "—"}{Number(item.rebateValue ?? 0) > 0 && <small>{item.rebateType === "PERCENT" ? `${Number(item.rebateValue) * 100}% informado` : "Em valor"}</small>}</span><span>{formatMoney(item.marginValue)}<small>{formatPercent(item.marginPercent)}</small></span><span className="history-row-action"><button type="button" onClick={() => setHistoryDetails(item)}>Ver detalhes</button></span></div>)}</div>
        ) : <div className="empty-inline">Nenhuma precificação salva para este produto neste navegador.</div>}
      </section>
      {historyDetails && <PricingDetailsModal item={historyDetails} onClose={() => setHistoryDetails(null)} />}
      {result && <section className="analysis-grid">
        <article className="wide-card">
          <div className="card-heading"><div><h2><BarChart3 size={17} /> Cenários de preço</h2><p>Impacto imediato de ±5% e ±10%, sem salvar.</p></div></div>
          <div className="scenario-grid">{scenarios.map((scenario) => <div className={scenario.variation === "0" ? "selected" : ""} key={scenario.variation}><span>{scenario.variation === "0" ? "Atual" : `${Number(scenario.variation) > 0 ? "+" : ""}${Number(scenario.variation) * 100}%`}</span><strong>{formatMoney(scenario.price)}</strong><small>{formatPercent(scenario.margin)}</small></div>)}</div>
        </article>
        <article className="wide-card">
          <div className="card-heading"><div><h2><GitCompareArrows size={17} /> Comparação entre canais</h2><p>{simulationMode === "target" ? `Preço necessário para atingir ${Number(targetMargin.replace(",", ".")).toLocaleString("pt-BR")}% em ${regionLabels[region]}.` : `Margem com o mesmo preço de venda em ${regionLabels[region]}.`}</p></div></div>
          <div className="comparison-groups">
            <div className="comparison-group marketplace-livre-group"><div className="comparison-group-title"><MarketplaceBrand marketplace="MERCADO_LIVRE" compact /><span>Mercado Livre</span></div><div className="comparison-group-options">{marketplaceComparison.filter((item) => item.marketplace === "MERCADO_LIVRE").map((scenario) => <ComparisonCard key={scenario.id} scenario={scenario} mode={simulationMode} targetMargin={targetMargin} />)}</div></div>
            {marketplaceComparison.filter((item) => item.marketplace !== "MERCADO_LIVRE").map((scenario) => <div className="comparison-group" key={scenario.id}><div className="comparison-group-title"><MarketplaceBrand marketplace={scenario.marketplace} compact /><span>{scenario.label}</span></div><ComparisonCard scenario={scenario} mode={simulationMode} targetMargin={targetMargin} /></div>)}
          </div>
        </article>
      </section>}
    </div>
  );
}
