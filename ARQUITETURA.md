# Arquitetura da primeira versão

## Fluxo principal

`Produto → configuração fiscal → marketplace/listagem → faixa vigente → preço/frete → PricingEngine → resultados por região → snapshot histórico`

O motor recebe apenas dados resolvidos e não consulta banco nem interface. Isso permite executar o mesmo cálculo no navegador, em Server Actions, em importações em lote e em testes de regressão.

## Entidades e relações

- `suppliers 1—N products`
- `fiscal_rules 1—N products`
- `products N—N marketplaces`, via `product_marketplace_configs`
- `marketplaces 1—N marketplace_fee_rule_sets 1—N marketplace_fee_bands`
- `products 1—N pricing_calculations`; cada cálculo referencia versões e preserva três snapshots JSONB.
- `products 1—N repricing_queue`; mudanças relevantes abrem trabalho de revisão.
- `audit_logs` recebe alterações críticas por trigger.
- `product_cost_history` registra a evolução monetária por usuário; triggers com `security invoker` alimentam `repricing_queue` quando dados relevantes mudam.
- `catalog_import_batches 1—N product_sources/catalog_import_issues` registra arquivo, hash, procedência e exceções sem escolhas silenciosas.

## Versionamento e segurança

Conjuntos tarifários e regras de cálculo são append-only do ponto de vista de negócio: uma mudança publica uma nova versão e encerra a vigência anterior. O histórico não recalcula registros antigos. Acesso usa Supabase Auth e RLS; nenhuma chave secreta é aceita no frontend.

## Estratégia de importação

1. Detectar cabeçalhos normalizados em cada aba de fornecedor.
2. Gerar uma prévia e sinalizar campos ambíguos, ST ausente e alíquotas fora da faixa.
3. Fazer upsert por SKU dentro de uma transação.
4. Preservar valores antigos como referência de reconciliação, nunca como fonte do motor.
5. Recalcular produtos afetados e criar itens na fila de reprecificação após confirmação.
