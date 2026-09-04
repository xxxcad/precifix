# Especificação técnica — Motor de precificação e margem de contribuição por marketplace

**Arquivos-fonte analisados:**

- `PLANILHA PRECIFICAÇÃO POR FABRICANTE.xlsx`
- `PLANILHA DE CUSTO MARKETPLACE.xlsx`

**Objetivo:** documentar o comportamento atual das planilhas de forma suficientemente precisa para que uma aplicação substitua o fluxo manual, mantendo rastreabilidade dos cálculos e abrindo espaço para automações, simulações e controles que hoje são difíceis de manter no Excel.

> **Escopo fiscal:** este documento faz engenharia reversa da lógica existente nas planilhas. Ele não valida se o tratamento tributário está correto do ponto de vista contábil/fiscal ou da legislação vigente. Na aplicação, qualquer alteração da regra tributária deve ser validada pela área fiscal/contábil antes de substituir a lógica aqui descrita.

---

## 1. Resumo executivo do processo atual

O processo atual tem duas fontes com funções diferentes:

1. **Planilha de precificação por fabricante:** funciona como cadastro mestre/manual dos produtos. Cada aba representa um fornecedor e guarda SKU, código do fabricante, produto, custo, dados fiscais de entrada, ICMS de saída por região e uma fotografia dos parâmetros/preços/margens de cada marketplace.
2. **Planilha de custo marketplace:** funciona como calculadora. Cada aba representa a combinação de **marketplace + regra de precificação** e contém as fórmulas efetivas usadas para transformar custo, impostos, preço de venda e tarifas em **margem de contribuição em R$ e em %**.

A aplicação deve separar claramente esses dois conceitos:

- **Dados persistentes do produto**: fornecedor, SKU, custo, perfil fiscal e configurações do anúncio.
- **Motor de cálculo**: regras versionadas e determinísticas que recebem parâmetros e retornam a margem.

A margem armazenada atualmente na planilha de fabricante deve ser tratada como **snapshot histórico**, não como fonte de verdade. A fonte de verdade da nova aplicação deve ser sempre o recálculo pelo motor vigente.

---

## 2. Faixas de saúde da margem de contribuição

As faixas informadas para o negócio são:

| Margem de contribuição | Classificação | Regra sugerida no sistema |
|---:|---|---|
| abaixo de 5,00% | Ruim | `margin_pct < 0.05` |
| 5,00% a 8,99% | Atenção | `0.05 <= margin_pct < 0.09` |
| 9,00% a 9,99% | Aceitável | `0.09 <= margin_pct < 0.10` |
| 10,00% ou mais* | OK | `margin_pct >= 0.10` |

\* A descrição fornecida diz “acima de 10%”, o que deixaria exatamente 10,00% sem categoria. Para a implementação, a recomendação é considerar **10,00% como OK**. Se a regra real for estritamente `> 10%`, esse limite deve ser parametrizado.

**Importante:** a formatação condicional atual das planilhas não representa essas quatro faixas com precisão. Em diversas abas existem apenas três grupos (<5%, 5%–9,99% e >=10%). A aplicação deve seguir as faixas acima, e não copiar a formatação do Excel.

---

## 3. Arquivo `PLANILHA PRECIFICAÇÃO POR FABRICANTE.xlsx`

- **25 abas no arquivo**, sendo **24 abas de fornecedores** e uma aba `Planilha1` sem estrutura de cadastro.
- **289 SKUs preenchidos** nas abas com cabeçalho de SKU.
- Não há fórmulas no arquivo: os valores de preço, tarifa e margem são dados gravados manualmente ou copiados de cálculos anteriores.
- Não há vínculos externos nem nomes definidos. Portanto, a planilha funciona como um cadastro estático, não como um modelo conectado.

### 3.1 Fornecedores encontrados

Maxeb, Souza, Beethoven, Maxcril, Fratelli, Alupan, Hidrolight, Jandaia, World, VMP, Power Maid, Rio de Ouro, CHINA, Jel Plast, SUTT, Petrin, Esbelt, Inga, MEK, Lyor, CIS, Haüskraft, Vista Home, Unitermi.

### 3.2 Estrutura padrão do cadastro

A maioria das abas usa o mesmo desenho de colunas:

| Grupo | Campo | Significado para a aplicação |
|---|---|---|
| Identificação | SKU | Identificador interno do produto |
| Identificação | COD FAB | Código do fabricante/fornecedor |
| Identificação | PRODUTO | Descrição/nome do produto |
| Fiscal entrada | CUSTO | Custo-base informado para a calculadora |
| Fiscal entrada | ST | Na prática, quando há ST, o campo contém **valor monetário de ST**, não apenas sim/não |
| Fiscal | Precificação | Regra fiscal: Nacional, Nacional ST, Importado, Importado ST ou Isento |
| Legado | Frete | Marcador auxiliar (`*`, `-` ou vazio); não participa diretamente das fórmulas da calculadora |
| Nota de entrada | ICMS | Alíquota de ICMS de entrada |
| Nota de entrada | PIS | Alíquota de PIS de entrada |
| Nota de entrada | COFINS | Alíquota de COFINS de entrada |
| Nota de entrada | IPI | Alíquota de IPI |
| Saída | ICMS SP | Alíquota de ICMS na venda para São Paulo |
| Saída | ICMS SS | Alíquota de ICMS para Sul/Sudeste |
| Saída | ICMS NN | Alíquota de ICMS para Norte/Nordeste |
| Mercado Livre | COMISSÃO | Percentual aplicado sobre o valor de venda |
| Mercado Livre | FIXO | Campo existente no cadastro, mas **não consumido pelas abas atuais da calculadora do ML** |
| Mercado Livre | FRETE | Custo estimado de frete usado no cálculo |
| Mercado Livre | ML | Preço normalmente praticado |
| Mercado Livre | % SP | Snapshot da margem calculada para SP |
| Shopee | COMISSÃO | Percentual da plataforma |
| Shopee | FIXO | Tarifa fixa por faixa de preço |
| Shopee | SHOPEE | Preço normalmente praticado |
| Shopee | % SP | Snapshot da margem calculada para SP |
| Amazon | COMISSÃO | Percentual da plataforma |
| Amazon | FRETE | Custo estimado de frete usado no cálculo |
| Amazon | AMAZON | Preço normalmente praticado |
| Amazon | % SP | Snapshot da margem calculada para SP |

### 3.3 Regras de precificação encontradas no cadastro

Nos produtos preenchidos foram encontrados os seguintes valores de regra:

| Regra | Quantidade de SKUs no cadastro atual |
|---|---:|
| Nacional | 106 |
| Nacional ST | 0 |
| Importado | 164 |
| Importado ST | 13 |
| Isento | 5 |

Há um SKU sem regra de precificação preenchida (`CHINA`, SKU 1320, “RALO”). A regra `Nacional ST` existe na calculadora, mas atualmente não aparece aplicada em nenhum SKU do cadastro.

### 3.4 Exceções de estrutura que impactam a importação

- **Alupan:** possui uma coluna adicional `Caixa` antes de `ST`, deslocando todas as colunas seguintes em uma posição. Um importador baseado em letras fixas de coluna quebraria nessa aba.
- **World:** a coluna de margem da Shopee existe visualmente na sequência, mas o cabeçalho `% SP` está ausente na linha de cabeçalhos.
- **Planilha1:** não contém o layout de produtos e deve ser ignorada na migração.
- Há uso de placeholders como `-`, ` - `, espaços e `*`. Eles devem ser normalizados para `null`/flag apropriada no processo de importação.
- Foram encontrados valores de ICMS de entrada atípicos (por exemplo, 1,65% em alguns SKUs). A migração deve **sinalizar**, mas não corrigir automaticamente, porque pode ser dado real ou erro de digitação.

**Regra de migração recomendada:** identificar colunas pelos **nomes dos cabeçalhos**, nunca por posição/letra da coluna.

---

## 4. Arquivo `PLANILHA DE CUSTO MARKETPLACE.xlsx`

O arquivo possui 16 abas de cálculo:

| Marketplace | Abas |
|---|---|
| Mercado Livre | `Nacional`, `Nacional ST`, `Importado`, `Importado ST`, `Isento` |
| Shopee | `Shopee nacional`, `Shopee nacional ST`, `Shopee Importado`, `Shopee Importado ST`, `Shopee Isento` |
| Amazon | `Amazon Nacional`, `Amazon Nacional st`, `Amazon Nacional  ST`, `Amazon Importado`, `Amazon Importado ST`, `Amazon Isento` |

### 4.1 Ponto crítico: duplicidade de Amazon Nacional ST

Existem duas abas com nomes quase iguais:

- `Amazon Nacional st`: usa **as mesmas fórmulas da regra Nacional normal**. O ICMS de entrada é calculado por percentual e o ICMS de saída em SP é 18%. Portanto, apesar do nome, esta aba **não implementa ST**.
- `Amazon Nacional  ST` (com dois espaços antes de `ST`): é a aba que realmente implementa ST, usando valor monetário de ST e ICMS de saída de 0% em SP.

Para a aplicação, devem existir apenas duas regras inequívocas: `NACIONAL` e `NACIONAL_ST`. A aba `Amazon Nacional st` deve ser tratada como **legado/duplicata** até validação de negócio.

---

## 5. Modelo conceitual comum dos cálculos

Todas as abas seguem a mesma ideia geral:

1. Calcular créditos/ajustes tributários da entrada e chegar ao **custo efetivo**.
2. Calcular os débitos tributários da venda para cada região.
3. Deduzir tarifa do marketplace e frete/tarifa fixa.
4. Calcular a venda líquida.
5. Subtrair o custo efetivo para obter a margem de contribuição em R$.
6. Dividir a margem em R$ pelo preço bruto de venda para obter a margem de contribuição %.

### 5.1 Variáveis sugeridas

```text
C           = custo de entrada
ST          = valor monetário de substituição tributária, quando aplicável
ICMS_IN     = alíquota de ICMS da entrada
PIS_IN      = alíquota de PIS da entrada
COFINS_IN   = alíquota de COFINS da entrada
IPI_IN      = alíquota de IPI
V           = preço bruto de venda
ICMS_OUT_R  = alíquota de ICMS de saída na região R
PIS_OUT     = alíquota de PIS de saída; atualmente 0 nas planilhas
COFINS_OUT  = alíquota de COFINS de saída; atualmente 0 nas planilhas
FEE_PCT     = comissão percentual do marketplace
FEE_FIXED   = tarifa fixa, quando aplicável
FREIGHT     = frete/custo logístico deduzido da venda, quando aplicável
```

**Recomendação de implementação:** usar decimal de precisão financeira (`Decimal`/`numeric`), não `float`. Manter máxima precisão durante o cálculo e arredondar apenas para exibição/lançamentos conforme regra definida.

---

## 6. Cálculo do custo efetivo

### 6.1 Regra normal — Mercado Livre e Shopee

Nas regras `Nacional` e `Importado`, Mercado Livre e Shopee calculam os créditos assim:

```text
icms_credit = C * ICMS_IN
pis_base    = C - icms_credit
pis_credit  = pis_base * PIS_IN
cofins_credit = pis_base * COFINS_IN
ipi_value   = C * IPI_IN

effective_cost = C - icms_credit - pis_credit - cofins_credit + ipi_value
```

Ou seja, para esses dois marketplaces o PIS/COFINS de entrada é calculado sobre o custo **líquido do ICMS de entrada**.

### 6.2 Regra normal — Amazon

A Amazon tem uma diferença real de fórmula no arquivo:

```text
icms_credit   = C * ICMS_IN
pis_credit    = C * PIS_IN
cofins_credit = C * COFINS_IN
ipi_value     = C * IPI_IN

effective_cost = C - icms_credit - pis_credit - cofins_credit + ipi_value
```

Na Amazon, PIS e COFINS de entrada são calculados sobre o **custo cheio**, sem subtrair antes o crédito de ICMS. Essa diferença deve ser copiada se o objetivo for reproduzir exatamente o Excel, mas deve ser validada com a área fiscal antes de ser consolidada como regra definitiva do novo sistema.

### 6.3 Regras com ST

Nas regras `Nacional ST` e `Importado ST`, o campo ST é um **valor monetário** informado diretamente. Ele é incorporado ao custo efetivo:

```text
pis_credit    = C * PIS_IN
cofins_credit = C * COFINS_IN
ipi_value     = C * IPI_IN

effective_cost = C + ST - pis_credit - cofins_credit + ipi_value
```

O ICMS de entrada percentual normalmente fica em 0 nessas abas; o valor de ST entra separadamente.

### 6.4 Regra Isento

Com ICMS, PIS, COFINS e IPI zerados:

```text
effective_cost = C
```

---

## 7. Impostos da venda por região

Para cada região, a planilha calcula:

```text
icms_debit = V * ICMS_OUT_R
pis_debit  = (V - icms_debit) * PIS_OUT
cofins_debit = (V - icms_debit) * COFINS_OUT

output_tax_debit = icms_debit + pis_debit + cofins_debit
```

No estado atual das 16 abas, `PIS_OUT = 0` e `COFINS_OUT = 0`. Logo, na prática atual:

```text
output_tax_debit = V * ICMS_OUT_R
```

A aplicação deve manter PIS/COFINS de saída configuráveis, mesmo que inicialmente zerados, para não exigir alteração estrutural futura.

### 7.1 Matriz padrão de ICMS de saída observada

| Regra | São Paulo | Sul/Sudeste | Norte/Nordeste |
|---|---:|---:|---:|
| Nacional | 18% | 12% | 7% |
| Nacional ST | 0% | 12% | 7% |
| Importado | 18% | 4% | 4% |
| Importado ST | 0% | 4% | 4% |
| Isento | 0% | 0% | 0% |

Esses valores aparecem de forma consistente nos templates. Entretanto, como a planilha de fabricantes guarda as três alíquotas por produto, a implementação recomendada é: **usar essa matriz como default da regra e permitir override explícito no produto**.

---

## 8. Fórmula final da margem de contribuição

A estrutura final pode ser normalizada como:

```text
platform_percentage_value = V * FEE_PCT

net_sale = V
           - platform_percentage_value
           - FEE_FIXED
           - FREIGHT
           - output_tax_debit

contribution_margin_value = net_sale - effective_cost
contribution_margin_pct   = contribution_margin_value / V
```

Cada marketplace muda apenas como `FEE_PCT`, `FEE_FIXED` e `FREIGHT` são obtidos.

---

## 9. Mercado Livre — regras específicas

### 9.1 Entradas relevantes

- Custo e impostos da entrada.
- Regra fiscal do produto.
- Preço de venda.
- Tarifa percentual **Clássico**.
- Tarifa percentual **Premium**.
- Frete estimado.
- ICMS de saída de SP / Sul-Sudeste / Norte-Nordeste.

### 9.2 Cálculo de tarifa

```text
ml_classic_fee = V * ML_CLASSIC_RATE
ml_premium_fee = V * ML_PREMIUM_RATE
```

O mesmo frete é aplicado nos dois tipos de anúncio e nas três regiões.

A planilha entrega seis resultados de margem:

- SP — Clássico
- SP — Premium
- Sul/Sudeste — Clássico
- Sul/Sudeste — Premium
- Norte/Nordeste — Clássico
- Norte/Nordeste — Premium

### 9.3 Campo `FIXO` do cadastro

A planilha de fabricantes possui um campo `FIXO` no bloco amarelo do Mercado Livre. Porém, **nenhuma das cinco abas atuais do Mercado Livre na planilha de custo usa uma tarifa fixa separada**. O cálculo usa apenas: percentual da tarifa + frete + imposto + custo efetivo.

Na aplicação, o campo pode ser preservado como `ml_fixed_fee` para compatibilidade/futuras regras, mas deve ficar **desabilitado no cálculo padrão atual** até que a regra de negócio seja confirmada.

---

## 10. Shopee — regras específicas

Na planilha de custo, a comissão e a tarifa fixa da Shopee não são digitadas: são calculadas automaticamente a partir do preço de venda.

### 10.1 Comissão percentual

```text
if V < 80.00:
    FEE_PCT = 0.20
else:
    FEE_PCT = 0.14
```

### 10.2 Tarifa fixa

```text
if 0 <= V < 80:
    FEE_FIXED = 4
elif 80 <= V < 100:
    FEE_FIXED = 16
elif 100 <= V < 200:
    FEE_FIXED = 20
else:  # V >= 200
    FEE_FIXED = 26
```

Portanto, os limites exatos são:

| Preço | Comissão | Tarifa fixa |
|---:|---:|---:|
| R$ 0,00 a R$ 79,99 | 20% | R$ 4,00 |
| R$ 80,00 a R$ 99,99 | 14% | R$ 16,00 |
| R$ 100,00 a R$ 199,99 | 14% | R$ 20,00 |
| R$ 200,00 ou mais | 14% | R$ 26,00 |

### 10.3 Observação importante de nomenclatura

Na área inferior das abas Shopee, a linha que deduz `D16` é chamada de **“frete”**. Porém `D16` é explicitamente a **TARIFA FIXA**. Para a aplicação, não deve ser chamada de frete; o nome correto do componente é `shopee_fixed_fee`.

### 10.4 Parametrização recomendada

Esses valores não devem ficar hardcoded para sempre. Criar uma tabela de faixas de tarifa com `effective_from`/`effective_to`, pois mudanças comerciais da Shopee devem poder ser cadastradas sem alterar código.

---

## 11. Amazon — regras específicas

### 11.1 Entradas relevantes

- Custo e impostos da entrada.
- Regra fiscal do produto.
- Preço de venda.
- Tarifa percentual Amazon.
- Frete estimado.
- ICMS de saída das três regiões.

### 11.2 Tarifa

```text
amazon_fee = V * AMAZON_RATE
```

Não existe tarifa fixa separada nas abas atuais. O frete é deduzido diretamente.

### 11.3 Diferença tributária relevante

Como descrito na seção de custo efetivo, as abas Amazon calculam créditos de PIS e COFINS sobre `C` diretamente, enquanto Mercado Livre/Shopee usam `C - crédito de ICMS` nas regras normais. Essa diferença precisa de confirmação fiscal antes do go-live, mas deve constar nos testes de paridade com o Excel.

Resposta: Isso estava sendo calculado errado, para a Amazon os créditos de PIS e COFINS tambem devem ser calculados por `C - crédito de ICMS`

---

## 12. Campos informativos que não determinam diretamente a margem

As abas também calculam `VALOR CRÉDITO`, `TOTAL CRÉDITO`, `VALOR IMPOSTO PAGO` e `% IMPOSTO`. Esses valores são úteis para auditoria, mas a margem final não usa diretamente o “valor imposto pago”.

A margem usa:

- o **custo efetivo**, já ajustado pelos créditos da entrada; e
- o **débito tributário bruto da venda** na linha `imposto`.

Isso é importante para não implementar a aplicação subtraindo créditos duas vezes.

### 12.1 Inconsistência encontrada no total de créditos de ST

- Mercado Livre ST: `TOTAL CRÉDITO` inclui o valor de ST + PIS + COFINS.
- Shopee ST: `TOTAL CRÉDITO` inclui apenas PIS + COFINS; o valor de ST fica fora desse total.
- Amazon ST: `TOTAL CRÉDITO` inclui o valor de ST + PIS + COFINS.

Essa diferença não altera a margem final nos templates atuais, porque o total de crédito é usado apenas na área informativa de imposto pago. Mesmo assim, deve ser resolvida conceitualmente antes de expor um indicador tributário único na aplicação.

---

## 13. Rastreabilidade: células principais do Excel

### 13.1 Mercado Livre

| Conceito | Célula/área |
|---|---|
| Custo | `D5` |
| ICMS entrada | `D6` |
| Valor ICMS / ST | `D7` |
| PIS entrada | `D8` |
| COFINS entrada | `D10` |
| IPI | `D13` |
| Tarifa Clássico | `D15` |
| Tarifa Premium | `D16` |
| Custo efetivo | `D18` |
| Venda SP | `G5` |
| ICMS saída SP / SS / NN | `G6` / `K6` / `O6` |
| Frete | `G22` |
| Margem R$ SP Clássico/Premium | `G27` / `H27` |
| Margem % SP Clássico/Premium | `G28` / `H28` |

### 13.2 Shopee

| Conceito | Célula/área |
|---|---|
| Custo | `D5` |
| ICMS entrada | `D6` |
| Valor ICMS / ST | `D7` |
| PIS entrada | `D8` |
| COFINS entrada | `D10` |
| IPI | `D13` |
| Comissão calculada por faixa | `D15` |
| Tarifa fixa calculada por faixa | `D16` |
| Custo efetivo | `D18` |
| Venda SP | `G5` |
| ICMS saída SP / SS / NN | `G6` / `K6` / `O6` |
| Margem R$ SP | `G29` |
| Margem % SP | `G30` |

### 13.3 Amazon

| Conceito | Célula/área |
|---|---|
| Custo | `C5` |
| ICMS entrada | `C6` |
| Valor ICMS / ST | `C7` |
| PIS entrada | `C8` |
| COFINS entrada | `C10` |
| IPI | `C13` |
| Tarifa Amazon | `C15` |
| Custo efetivo | `C17` |
| Venda SP | `F5` |
| ICMS saída SP / SS / NN | `F6` / `J6` / `N6` |
| Frete | `F22` |
| Margem R$ SP | `F27` |
| Margem % SP | `F28` |

---

## 14. Pseudocódigo recomendado para o motor

O pseudocódigo abaixo representa a arquitetura recomendada, separando regras fiscais de regras comerciais do marketplace.

```ts
type FiscalRule =
  | "NACIONAL"
  | "NACIONAL_ST"
  | "IMPORTADO"
  | "IMPORTADO_ST"
  | "ISENTO";

type Marketplace = "MERCADO_LIVRE" | "SHOPEE" | "AMAZON";
type Region = "SP" | "SUL_SUDESTE" | "NORTE_NORDESTE";

function calculateEffectiveCost(input) {
  const C = input.cost;
  const ipiValue = C * input.ipiIn;

  if (input.rule === "ISENTO") return C;

  if (input.rule === "NACIONAL_ST" || input.rule === "IMPORTADO_ST") {
    const pisCredit = C * input.pisIn;
    const cofinsCredit = C * input.cofinsIn;
    return C + input.stAmount - pisCredit - cofinsCredit + ipiValue;
  }

  const icmsCredit = C * input.icmsIn;
  const pisCofinsBase =
    input.marketplace === "AMAZON" ? C : C - icmsCredit;
  const pisCredit = pisCofinsBase * input.pisIn;
  const cofinsCredit = pisCofinsBase * input.cofinsIn;

  return C - icmsCredit - pisCredit - cofinsCredit + ipiValue;
}

function calculateOutputTaxes(input, region) {
  const V = input.salePrice;
  const icmsDebit = V * input.icmsOut[region];
  const pisDebit = (V - icmsDebit) * input.pisOut;
  const cofinsDebit = (V - icmsDebit) * input.cofinsOut;
  return icmsDebit + pisDebit + cofinsDebit;
}

function getShopeeFees(price) {
  const percent = price < 80 ? 0.20 : 0.14;
  const fixed =
    price < 80 ? 4 :
    price < 100 ? 16 :
    price < 200 ? 20 : 26;
  return { percent, fixed };
}

function calculateMargin(input, region, marketplaceFees) {
  const effectiveCost = calculateEffectiveCost(input);
  const taxes = calculateOutputTaxes(input, region);
  const percentFeeValue = input.salePrice * marketplaceFees.percent;

  const netSale = input.salePrice
    - percentFeeValue
    - marketplaceFees.fixed
    - marketplaceFees.freight
    - taxes;

  const marginValue = netSale - effectiveCost;
  const marginPct = marginValue / input.salePrice;

  return { effectiveCost, taxes, netSale, marginValue, marginPct };
}
```

---

## 15. Modelo de dados recomendado

### 15.1 `suppliers`

- `id`
- `name`
- `active`

### 15.2 `products`

- `id`
- `supplier_id`
- `sku` — único
- `manufacturer_code`
- `name`
- `cost`
- `pricing_rule`
- `st_amount` — nullable; obrigatório para regra ST
- `input_icms_rate`
- `input_pis_rate`
- `input_cofins_rate`
- `input_ipi_rate`
- `output_icms_sp_rate`
- `output_icms_south_southeast_rate`
- `output_icms_north_northeast_rate`
- `units_per_box` — opcional, útil para o caso Alupan
- `legacy_freight_flag` — opcional para preservar o marcador atual até entender sua função
- timestamps e usuário da última alteração

### 15.3 `product_marketplace_configs`

- `product_id`
- `marketplace`
- `current_sale_price`
- `commission_rate_override` — nullable
- `fixed_fee_override` — nullable
- `freight_cost` — nullable
- `listing_type` — por exemplo, ML Clássico/Premium quando aplicável
- `active`

### 15.4 `marketplace_fee_schedules`

Tabela versionada para evitar tarifas hardcoded:

- `marketplace`
- `rule_name` / categoria / tipo de anúncio
- `min_price` / `max_price`
- `percentage_rate`
- `fixed_fee`
- `effective_from`
- `effective_to`

### 15.5 `pricing_calculations` / histórico opcional

Salvar uma execução apenas quando houver valor de auditoria, por exemplo alteração de preço ou aprovação:

- produto, marketplace, região
- inputs usados
- versão da regra/tabela de tarifas
- custo efetivo
- impostos
- tarifa/frete
- margem R$ e %
- usuário/data

---

## 16. Fluxo recomendado da aplicação

1. Usuário pesquisa por SKU, código do fabricante, nome ou fornecedor.
2. O sistema carrega automaticamente custo, regra fiscal e impostos do produto.
3. Usuário escolhe marketplace.
4. O sistema carrega tarifa/frete conhecidos e a tabela comercial vigente.
5. Usuário informa ou altera o preço a simular.
6. A aplicação calcula simultaneamente SP, Sul/Sudeste e Norte/Nordeste.
7. No Mercado Livre, exibir Clássico e Premium lado a lado.
8. Mostrar decomposição da margem: preço, tarifa, taxa fixa, frete, imposto, custo efetivo, margem R$ e margem %.
9. Aplicar a classificação visual de margem definida na seção 2.
10. Permitir salvar um novo preço/configuração somente após confirmação do usuário.

---

## 17. Melhorias possíveis além do Excel

As seguintes funcionalidades são naturais para a nova aplicação e não alteram o motor de cálculo:

- **Preço-alvo automático:** informar margem desejada (ex.: 10%) e calcular o preço mínimo necessário. Hoje o fluxo principal é “informo R$ 99,90 → descubro que tenho 8,4% de margem”. A aplicação também deveria permitir “quero 10%, 12% ou 15% de margem → qual preço preciso praticar?”. Idealmente mostrar Preço de equilíbrio (0%), Preço mínimo aceitável (9%), Preço OK (10%) e um preço para uma margem-alvo definida pelo usuário. Isso provavelmente será uma das funções mais usadas do sistema.
- **Comparação simultânea entre marketplaces:** um SKU com o mesmo preço ou preços diferentes, exibindo qual canal oferece melhor margem. Em vez de sempre selecionar um marketplace individualmente, permitir abrir um SKU e perguntar: “Se eu vender este produto por R$ 99,90, qual é minha margem em Mercado Livre, Shopee e Amazon?”. Isso ajuda muito na decisão de onde competir por preço e onde preservar margem.
- **Simulador de preço em tempo real:** Ao alterar o preço, mostrar imediatamente como a margem muda, sem precisar salvar cada simulação. Algo como R$ 89,90 → 5,3%, R$ 94,90 → 8,7%, R$ 99,90 → 11,6%. Também poderia gerar automaticamente uma pequena tabela de cenários ±5%, ±10% do preço informado.
- **Simulador de sensibilidade:** mostrar impacto na margem ao variar preço, frete, comissão ou custo.
- **Alertas de margem:** destacar SKUs abaixo da faixa mínima e registrar exceções aprovadas.
- **Histórico de custo/preço:** permitir entender por que a margem mudou ao longo do tempo.
- **Preço mínimo por marketplace:** O sistema deveria calcular e armazenar algo como Mercado Livre: não vender abaixo de R$ 93,42, Shopee: R$ 89,70, Amazon: R$ 96,18.
- **Tarifas versionadas por vigência:** mudanças de Shopee/Amazon/ML entram como configuração, não alteração de código.
- **Validação de dados fiscais:** alertas para alíquotas fora de faixas esperadas, sem correção automática.
- **Cálculo em lote:** recalc de todos os SKUs após mudança de comissão, frete ou imposto.
- **Recomendações de preço:** listar o menor preço que coloca o produto em “Aceitável” ou “OK”.
- **Fila de produtos que precisam ser reprecificados:** Essa é especialmente importante para sua operação. Se o custo do SKU aumentar, a tarifa do marketplace mudar ou uma regra tributária mudar, o sistema deveria automaticamente marcar os produtos impactados como “Revisão de preço necessária”. Em vez de vocês precisarem descobrir quais produtos revisar, a própria aplicação gera a fila de trabalho.
- **Atualização de custo em massa por fornecedor:** Quando chegar uma nova tabela de preços de um fornecedor, seria muito ruim editar SKU por SKU. Eu criaria importação por Excel/CSV com comparação Custo anterior → Custo novo → Variação % → impacto estimado na margem, antes de confirmar a atualização. Depois da confirmação, os produtos afetados entram automaticamente na fila de reprecificação.
- **Explicabilidade do cálculo:** Além do breakdown tradicional, eu criaria um botão “Como chegamos nesta margem?”. Ele mostraria uma sequência extremamente clara: Venda R$ 99,90 → Comissão -R$ X → Tarifa fixa -R$ Y → Frete -R$ Z → Tributos... → Custo efetivo... → Margem R$ 11,42 / 11,43%. Isso será muito útil para conferir resultado, treinar novos analistas e investigar divergências.

---

## 18. Regras de validação recomendadas

- `sale_price > 0`.
- `cost >= 0`.
- Alíquotas entre 0 e 1 (0%–100%).
- `st_amount` obrigatório e >=0 quando a regra for ST.
- `st_amount` deve ser zero/null nas regras sem ST, salvo exceção explicitamente aprovada.
- Shopee deve calcular comissão e tarifa fixa pelo schedule vigente, em vez de aceitar valores manuais silenciosamente.
- Frete obrigatório para ML/Amazon quando a configuração do anúncio exigir essa dedução; permitir zero explicitamente.
- Impedir divisão por zero no cálculo de margem %.
- Toda alteração de custo, imposto ou tarifa deve registrar usuário/data e, idealmente, versão anterior.

---

## 19. Estratégia de migração do Excel

### Etapa 1 — Importação do cadastro

- Ler cada aba de fornecedor.
- Usar cabeçalhos, não posições fixas.
- Transformar nome da aba em `supplier`.
- Normalizar `-`, espaços e placeholders.
- Preservar margens antigas em campos `legacy_margin_*`, nunca como cálculo oficial.

### Etapa 2 — Normalização fiscal

- Converter `Precificação` para enum.
- Separar `has_st` da informação monetária `st_amount`.
- Validar taxas de entrada e saída.
- Marcar registros sem regra ou com valores suspeitos para revisão.

### Etapa 3 — Reconciliação

- Recalcular cada SKU com o novo motor.
- Comparar com o snapshot `% SP` do Excel.
- Gerar relatório de diferença absoluta e em pontos percentuais.
- Investigar somente divergências relevantes; snapshots antigos podem refletir tarifas/preços históricos.

### Etapa 4 — Corte

- Após aprovação da paridade, congelar as planilhas como arquivo histórico.
- Definir a aplicação como fonte oficial de cadastro e cálculo.

---

## 20. Pontos que exigem decisão/validação antes do desenvolvimento definitivo

1. **Amazon e base de PIS/COFINS:** confirmar se a diferença de base em relação a ML/Shopee é intencional.
Resposta: Isso estava errado, para a Amazon os créditos de PIS e COFINS tambem devem ser calculados por `C - crédito de ICMS`
2. **Amazon Nacional ST duplicado:** definir se `Amazon Nacional st` deve ser descartada como aba legada.
Resposta: Sim, ela deve ser descartada
3. **Mercado Livre — FIXO:** confirmar se existe atualmente uma tarifa fixa que deva ser somada ao cálculo. O cadastro tem o campo, mas a calculadora não o usa.
Resposta: Mercado Livre não tem mais tarifa fixa.
4. **Exatamente 10,00% de margem:** confirmar se deve ser `OK`; este documento recomenda que sim.
Resposta: Sim, 10,00% é OK
5. **PIS/COFINS na saída:** estão zerados em todos os templates; confirmar se isso é regra permanente ou configuração atual.
R: Regra permanente para o nosso cenário
6. **Indicador “VALOR IMPOSTO PAGO”:** decidir se a aplicação precisa exibi-lo; as regras de crédito ST são inconsistentes entre marketplaces, embora isso não afete a margem final.
R: Não precisa mostra explicitamente
7. **Campo legado `Frete` antes dos impostos no cadastro:** esclarecer a semântica do marcador `*`/`-` se ele precisar ser preservado funcionalmente.
R:Não precisa ser preservado, nao utilizamos isso

---


## 21. Critérios de aceite para substituir o Excel

A aplicação pode ser considerada pronta para substituir a rotina atual quando:

- calcular corretamente as três regiões e os dois tipos de anúncio do Mercado Livre;
- aplicar automaticamente as faixas vigentes da Shopee;
- suportar as cinco regras fiscais;
- permitir valor monetário de ST;
- mostrar decomposição completa da margem, não apenas o percentual final;
- manter tarifas e regras comerciais versionáveis;
- importar os 24 layouts de fornecedores sem depender de letras fixas de coluna;
- sinalizar dados inconsistentes sem alterá-los automaticamente;
- registrar histórico/auditoria de alterações críticas;
- permitir que a margem seja sempre recalculada, eliminando snapshots desatualizados como fonte operacional.

---

## 23. Conclusão técnica

O núcleo do sistema pode ser construído com um único motor de margem, combinando: **perfil fiscal do produto + região de destino + regra comercial do marketplace**. As 16 abas atuais não precisam virar 16 implementações independentes; elas podem ser reduzidas a cinco perfis fiscais e três adapters de marketplace, com pequenas exceções explicitamente documentadas.

A decisão mais importante de arquitetura é não transportar para o sistema as redundâncias do Excel. O cadastro deve guardar fatos do produto; as tarifas devem ser versionadas; e a margem deve ser calculada em tempo real. Dessa forma, alterações de custo, frete, comissão ou regra fiscal deixam de exigir copiar dados entre planilhas e passam a gerar uma resposta imediata e auditável.

**Status deste documento:** especificação de engenharia reversa pronta para servir como base de implementação e para uma etapa seguinte de definição de requisitos da aplicação/UX/API.