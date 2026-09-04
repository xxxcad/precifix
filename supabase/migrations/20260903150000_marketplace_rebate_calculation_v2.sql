insert into public.calculation_rule_versions (
  version,
  code,
  status,
  specification,
  change_reason,
  effective_from
)
values (
  2,
  'recommended-v2',
  'PUBLISHED',
  '{"decimalPrecision":32,"rounding":"HALF_UP","outputPisRate":"0","outputCofinsRate":"0","amazonPisCofinsBase":"costMinusIcmsCredit","marketplaceRebate":"discountOnPercentageCommissionOnly","marketplaceRebateLimit":"grossPercentageCommission"}'::jsonb,
  'Adiciona rebate em valor ou percentual, limitado à comissão percentual do marketplace',
  '2026-09-03T00:00:00-03:00'
)
on conflict (code) do nothing;
