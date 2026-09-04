import Decimal from "decimal.js";
import type {
  FeeBand,
  MarginClassificationRule,
  PricingInput,
  PricingResult,
  RegionKey,
  RegionPricingResult,
} from "./types";

Decimal.set({ precision: 32, rounding: Decimal.ROUND_HALF_UP });

const REGIONS: RegionKey[] = ["SP", "SUL_SUDESTE", "NORTE_NORDESTE"];
const d = (value: Decimal.Value) => new Decimal(value || 0);
const serialize = (value: Decimal) => value.toDecimalPlaces(12).toFixed();

export function resolveFeeBand(price: Decimal.Value, bands: FeeBand[]): FeeBand {
  const value = d(price);
  const band = bands.find((candidate) => {
    const aboveMinimum = value.greaterThanOrEqualTo(candidate.minPrice);
    const belowMaximum = candidate.maxPrice === null || value.lessThan(candidate.maxPrice);
    return aboveMinimum && belowMaximum;
  });
  if (!band) throw new Error("Nenhuma faixa tarifária vigente cobre o preço informado.");
  return band;
}

export function classifyMargin(
  marginPercent: Decimal.Value,
  classifications: MarginClassificationRule[],
): MarginClassificationRule {
  const margin = d(marginPercent);
  const match = classifications.find((rule) => {
    const aboveMinimum = rule.minPercent === null || margin.greaterThanOrEqualTo(rule.minPercent);
    const belowMaximum = rule.maxPercent === null || margin.lessThan(rule.maxPercent);
    return aboveMinimum && belowMaximum;
  });
  if (!match) throw new Error("As faixas de classificação possuem uma lacuna.");
  return match;
}

function calculateEffectiveCost(input: PricingInput) {
  const cost = d(input.product.cost);
  if (input.product.fiscalRule === "ISENTO") {
    return {
      effectiveCost: cost,
      inputIcmsCredit: d(0),
      inputPisCredit: d(0),
      inputCofinsCredit: d(0),
      inputIpiValue: d(0),
    };
  }

  const ipi = cost.times(input.product.inputIpiRate);
  const hasSt = input.product.fiscalRule.endsWith("_ST");
  if (hasSt) {
    const pis = cost.times(input.product.inputPisRate);
    const cofins = cost.times(input.product.inputCofinsRate);
    return {
      effectiveCost: cost.plus(input.product.stAmount).minus(pis).minus(cofins).plus(ipi),
      inputIcmsCredit: d(0),
      inputPisCredit: pis,
      inputCofinsCredit: cofins,
      inputIpiValue: ipi,
    };
  }

  const icms = cost.times(input.product.inputIcmsRate);
  const pisCofinsBase = cost.minus(icms);
  const pis = pisCofinsBase.times(input.product.inputPisRate);
  const cofins = pisCofinsBase.times(input.product.inputCofinsRate);
  return {
    effectiveCost: cost.minus(icms).minus(pis).minus(cofins).plus(ipi),
    inputIcmsCredit: icms,
    inputPisCredit: pis,
    inputCofinsCredit: cofins,
    inputIpiValue: ipi,
  };
}

export function calculatePricing(input: PricingInput): PricingResult {
  const salePrice = d(input.salePrice);
  if (!salePrice.isPositive()) throw new Error("O preço de venda deve ser maior que zero.");
  const shipping = d(input.shippingCost);
  if (shipping.isNegative()) throw new Error("O frete não pode ser negativo.");

  const feeBand = resolveFeeBand(salePrice, input.marketplaceRule.feeBands);
  const percentageFee = salePrice.times(feeBand.percentageRate);
  const rebateValue = d(input.marketplaceRebateValue);
  if (rebateValue.isNegative()) throw new Error("O rebate não pode ser negativo.");
  const requestedRebate = input.marketplaceRebateType === "PERCENT" ? salePrice.times(rebateValue) : rebateValue;
  const marketplaceRebate = Decimal.min(requestedRebate, percentageFee);
  const fixedFee = d(feeBand.fixedFee);
  const costs = calculateEffectiveCost(input);
  const regions = {} as Record<RegionKey, RegionPricingResult>;

  for (const region of REGIONS) {
    const outputIcmsRate = d(input.product.outputIcmsRates[region]);
    const outputIcms = salePrice.times(outputIcmsRate);
    const netRevenue = salePrice.minus(percentageFee).plus(marketplaceRebate).minus(fixedFee).minus(shipping).minus(outputIcms);
    const marginValue = netRevenue.minus(costs.effectiveCost);
    const marginPercent = marginValue.dividedBy(salePrice);
    const classification = classifyMargin(marginPercent, input.classifications);

    regions[region] = {
      region,
      salePrice: serialize(salePrice),
      productCost: serialize(d(input.product.cost)),
      effectiveCost: serialize(costs.effectiveCost),
      inputIcmsCredit: serialize(costs.inputIcmsCredit),
      inputPisCredit: serialize(costs.inputPisCredit),
      inputCofinsCredit: serialize(costs.inputCofinsCredit),
      inputIpiValue: serialize(costs.inputIpiValue),
      marketplacePercentageFee: serialize(percentageFee),
      marketplaceRebate: serialize(marketplaceRebate),
      marketplaceFixedFee: serialize(fixedFee),
      shippingCost: serialize(shipping),
      outputIcms: serialize(outputIcms),
      netRevenue: serialize(netRevenue),
      contributionMarginValue: serialize(marginValue),
      contributionMarginPercent: serialize(marginPercent),
      classification,
      breakdown: [
        { key: "sale", label: "Preço de venda", category: "revenue", value: serialize(salePrice), explanation: "Receita bruta informada para a simulação." },
        { key: "percentage-fee", label: "Comissão do marketplace", category: "fee", value: serialize(percentageFee.negated()), rate: feeBand.percentageRate, explanation: `Faixa vigente: ${feeBand.label}.` },
        { key: "marketplace-rebate", label: "Rebate da plataforma", category: "credit", value: serialize(marketplaceRebate), explanation: "Desconto concedido exclusivamente sobre a comissão percentual do marketplace." },
        { key: "fixed-fee", label: "Tarifa fixa", category: "fee", value: serialize(fixedFee.negated()), explanation: "Tarifa fixa da faixa de preço vigente." },
        { key: "shipping", label: "Frete", category: "shipping", value: serialize(shipping.negated()), explanation: "Custo logístico informado ou configurado para o anúncio." },
        { key: "output-icms", label: `ICMS de saída — ${region}`, category: "tax", value: serialize(outputIcms.negated()), rate: serialize(outputIcmsRate), explanation: "Débito de ICMS sobre o preço de venda para a região." },
        { key: "effective-cost", label: "Custo efetivo", category: "cost", value: serialize(costs.effectiveCost.negated()), explanation: "Custo ajustado por créditos de entrada, ST e IPI." },
        { key: "margin", label: "Margem de contribuição", category: "margin", value: serialize(marginValue), rate: serialize(marginPercent), explanation: "Venda líquida menos o custo efetivo." },
      ],
    };
  }

  return { calculationVersion: "recommended-v2", feeBand, regions, snapshot: input };
}

export function calculateLegacyAmazonEffectiveCost(input: PricingInput): string {
  const cost = d(input.product.cost);
  const hasSt = input.product.fiscalRule.endsWith("_ST");
  if (input.product.fiscalRule === "ISENTO" || hasSt) {
    return calculatePricing(input).regions.SP.effectiveCost;
  }
  const icms = cost.times(input.product.inputIcmsRate);
  const pis = cost.times(input.product.inputPisRate);
  const cofins = cost.times(input.product.inputCofinsRate);
  const ipi = cost.times(input.product.inputIpiRate);
  return serialize(cost.minus(icms).minus(pis).minus(cofins).plus(ipi));
}

export function calculateTargetPrice(input: PricingInput, region: RegionKey, targetPercent: string): string {
  const target = d(targetPercent);
  const costs = calculateEffectiveCost(input).effectiveCost;
  const shipping = d(input.shippingCost);
  const taxRate = d(input.product.outputIcmsRates[region]);
  const candidates: Decimal[] = [];

  for (const band of input.marketplaceRule.feeBands) {
    const feeRate = d(band.percentageRate);
    const rebateValue = d(input.marketplaceRebateValue);
    const rebateRate = input.marketplaceRebateType === "PERCENT" ? Decimal.min(rebateValue, feeRate) : d(0);
    const denominator = d(1).minus(feeRate).plus(rebateRate).minus(taxRate).minus(target);
    if (denominator.isPositive()) {
      const fixedRebate = input.marketplaceRebateType === "VALUE" ? rebateValue : d(0);
      const raw = costs.plus(shipping).plus(band.fixedFee).minus(fixedRebate).dividedBy(denominator);
      const candidate = Decimal.max(raw, d(band.minPrice), d("0.01"));
      const rebateCoveredByCommission = input.marketplaceRebateType !== "VALUE" || candidate.times(feeRate).greaterThanOrEqualTo(rebateValue);
      const insideBand = band.maxPrice === null || candidate.lessThan(band.maxPrice);
      if (insideBand && rebateCoveredByCommission) candidates.push(candidate);
    }
    if (input.marketplaceRebateType === "VALUE") {
      const noCommissionDenominator = d(1).minus(taxRate).minus(target);
      if (!noCommissionDenominator.isPositive()) continue;
      const raw = costs.plus(shipping).plus(band.fixedFee).dividedBy(noCommissionDenominator);
      const candidate = Decimal.max(raw, d(band.minPrice), d("0.01"));
      const rebateExceedsCommission = candidate.times(feeRate).lessThan(rebateValue);
      const insideBand = band.maxPrice === null || candidate.lessThan(band.maxPrice);
      if (insideBand && rebateExceedsCommission) candidates.push(candidate);
    }
  }

  if (candidates.length === 0) throw new Error("Não foi possível atingir a margem alvo nas faixas configuradas.");
  return Decimal.min(...candidates).toDecimalPlaces(2, Decimal.ROUND_UP).toFixed(2);
}
