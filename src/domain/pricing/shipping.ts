import Decimal from "decimal.js";
import type { MarketplaceShippingRule, ShippingResolution } from "./types";

const serialize = (value: Decimal) => value.toDecimalPlaces(12).toFixed();
const orderedByPosition = <T extends { sortOrder: number }>(items: ReadonlyArray<T>) => [...items].sort((left, right) => left.sortOrder - right.sortOrder);

export function calculateCubicWeightKg(heightCm: string, widthCm: string, lengthCm: string): string {
  const height = new Decimal(heightCm.replace(",", ".") || 0);
  const width = new Decimal(widthCm.replace(",", ".") || 0);
  const length = new Decimal(lengthCm.replace(",", ".") || 0);
  if (!height.isPositive() || !width.isPositive() || !length.isPositive()) throw new Error("As dimensões devem ser maiores que zero.");
  return height.times(width).times(length).dividedBy(6000).toDecimalPlaces(6).toFixed();
}

export function resolveMercadoLivreShipping(price: string, realWeightKg: string, cubicWeightKg: string, rule: MarketplaceShippingRule): ShippingResolution {
  const salePrice = new Decimal(price || 0);
  const realWeight = new Decimal(realWeightKg || 0);
  const cubicWeight = new Decimal(cubicWeightKg || 0);
  if (!salePrice.isPositive() || !realWeight.isPositive() || !cubicWeight.isPositive()) throw new Error("Preço, peso real e peso cubado devem ser maiores que zero.");
  const weight = Decimal.max(realWeight, cubicWeight);
  const weightBasis = cubicWeight.greaterThan(realWeight) ? "CUBIC" : "REAL";
  const priceBand = orderedByPosition(rule.priceBands).find((band) => band.maxPrice === null || salePrice.lessThanOrEqualTo(band.maxPrice));
  const weightBand = orderedByPosition(rule.weightBands).find((band) => band.maxWeightKg === null || weight.lessThanOrEqualTo(band.maxWeightKg));
  if (!priceBand || !weightBand) throw new Error("A regra de frete não cobre o preço ou peso informado.");
  const rate = rule.rates.find((item) => item.priceBandId === priceBand.id && item.weightBandId === weightBand.id);
  if (!rate) throw new Error("Valor de frete não encontrado para as faixas selecionadas.");
  const tableCost = new Decimal(rate.cost);
  const calculated = salePrice.lessThan(19) ? Decimal.min(tableCost, salePrice.times("0.5")) : tableCost;
  return {
    source: "AUTOMATIC", cost: serialize(calculated), calculatedCost: serialize(calculated), ruleSetId: rule.id, version: rule.version,
    priceBandId: priceBand.id, priceBandLabel: priceBand.label, weightBandId: weightBand.id, weightBandLabel: weightBand.label,
    billableWeightKg: serialize(weight), weightBasis,
  };
}

export function resolveAmazonShipping(price: string, realWeightKg: string, cubicWeightKg: string, rule: MarketplaceShippingRule): ShippingResolution {
  const salePrice = new Decimal(price || 0);
  const realWeight = new Decimal(realWeightKg || 0);
  const cubicWeight = new Decimal(cubicWeightKg || 0);
  if (!salePrice.isPositive() || !realWeight.isPositive() || !cubicWeight.isPositive()) throw new Error("Preço, peso real e peso cubado devem ser maiores que zero.");
  const weight = Decimal.max(realWeight, cubicWeight);
  const weightBasis = cubicWeight.greaterThan(realWeight) ? "CUBIC" : "REAL";
  const priceBand = orderedByPosition(rule.priceBands).find((band) => band.maxPrice === null || salePrice.lessThanOrEqualTo(band.maxPrice));
  const orderedWeightBands = orderedByPosition(rule.weightBands);
  const lastWeightBand = orderedWeightBands.at(-1);
  const weightBand = orderedWeightBands.find((band) => band.maxWeightKg === null || weight.lessThanOrEqualTo(band.maxWeightKg)) ?? lastWeightBand;
  if (!priceBand || !weightBand) throw new Error("A regra de frete da Amazon não cobre o preço ou peso informado.");
  const rate = rule.rates.find((item) => item.priceBandId === priceBand.id && item.weightBandId === weightBand.id);
  if (!rate) throw new Error("Valor de frete da Amazon não encontrado para as faixas selecionadas.");
  const maximumWeight = new Decimal(lastWeightBand?.maxWeightKg ?? weight);
  const additionalKg = Decimal.max(0, weight.minus(maximumWeight)).ceil();
  const additionalRate = rule.additionalKgRates?.find((item) => item.priceBandId === priceBand.id);
  const calculated = new Decimal(rate.cost).plus(additionalKg.times(additionalRate?.costPerKg ?? 0));
  const weightLabel = additionalKg.isPositive() ? `${weightBand.label} + ${additionalKg.toFixed()} kg adicional(is)` : weightBand.label;
  return {
    source: "AUTOMATIC", cost: serialize(calculated), calculatedCost: serialize(calculated), ruleSetId: rule.id, version: rule.version,
    priceBandId: priceBand.id, priceBandLabel: priceBand.label, weightBandId: weightBand.id, weightBandLabel: weightLabel,
    billableWeightKg: serialize(weight), weightBasis,
  };
}

export function overrideShipping(resolution: ShippingResolution, cost: string): ShippingResolution {
  const value = new Decimal(cost || 0);
  if (value.isNegative()) throw new Error("O frete não pode ser negativo.");
  return { ...resolution, source: "MANUAL_OVERRIDE", cost: serialize(value) };
}

export function manualShipping(cost: string): ShippingResolution {
  const value = new Decimal(cost || 0);
  if (value.isNegative()) throw new Error("O frete não pode ser negativo.");
  return { source: "MANUAL", cost: serialize(value), calculatedCost: null, ruleSetId: null, version: null, priceBandId: null, priceBandLabel: null, weightBandId: null, weightBandLabel: null, billableWeightKg: null, weightBasis: null };
}
