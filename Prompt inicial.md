Você atuará como arquiteto de software, desenvolvedor full-stack sênior
e analista de regras de negócio para construir uma aplicação interna de
precificação de produtos para marketplaces.

Estou anexando três arquivos que devem ser analisados antes e durante o
desenvolvimento:

PLANILHA PRECIFICAÇÃO POR FABRICANTE.xlsx

PLANILHA DE CUSTO MARKETPLACE.xlsx

ESPECIFICACAO_PRECIFICACAO_MARKETPLACES.md

1.  CONTEXTO DO NEGÓCIO

Somos um ecommerce no regime tributário de Lucro Real.

Atualmente operamos principalmente nos marketplaces:

Mercado Livre

Shopee

Amazon

Cada marketplace possui regras próprias de comissão, tarifa fixa, frete
e cálculo.

Hoje nosso processo depende das duas planilhas Excel anexadas.

A PLANILHA PRECIFICAÇÃO POR FABRICANTE.xlsx funciona como cadastro
mestre dos produtos.

Cada aba representa atualmente um fornecedor e contém informações como:

SKU

Código do fabricante

Nome do produto

Fornecedor

Preço de custo

Substituição Tributária

Regra de precificação

ICMS de entrada

PIS de entrada

COFINS de entrada

IPI

ICMS de saída para diferentes regiões

informações específicas para Mercado Livre

informações específicas para Shopee

informações específicas para Amazon

preços atualmente praticados

taxas

fretes

margens calculadas

A PLANILHA DE CUSTO MARKETPLACE.xlsx contém o motor atual de cálculo.

Cada aba representa uma combinação entre:

Marketplace + Regra fiscal/regra de precificação.

As fórmulas dessa planilha são hoje utilizadas para chegar ao resultado
final da margem de contribuição.

O arquivo ESPECIFICACAO_PRECIFICACAO_MARKETPLACES.md foi criado após uma
engenharia reversa inicial dessas duas planilhas e contém:

regras identificadas;

fórmulas;

diferenças entre marketplaces;

problemas encontrados;

arquitetura sugerida;

melhorias recomendadas;

pontos que precisam de atenção.

Leia o arquivo inteiro, inclusive principalmente o item 17 e suas
funcionalidades propostas.

2.  PRINCÍPIO MAIS IMPORTANTE DO SISTEMA

A precisão financeira e tributária é prioridade absoluta.

Não simplifique fórmulas apenas para facilitar a implementação.

Não faça aproximações silenciosas.

Não utilize float comum para cálculos monetários.

Utilize tipos decimais adequados para:

valores monetários;

percentuais;

impostos;

tarifas;

margens.

Os resultados da aplicação precisam ser reproduzíveis e auditáveis.

As planilhas representam o comportamento atual do negócio.

O Markdown representa uma engenharia reversa inicial e também contém
propostas de melhoria.

Caso encontre alguma divergência entre:

fórmula existente no Excel;

descrição do Markdown;

interpretação da regra;

NÃO escolha silenciosamente uma opção.

Primeiro identifique e documente a divergência.

Para fins de comparação com o sistema atual, considere a fórmula
efetivamente existente no Excel como referência do comportamento legado.

Entretanto, não perpetue erros ou inconsistências arquiteturais apenas
porque existem no Excel.

Separe claramente:

comportamento legado

de

comportamento recomendado para a nova aplicação.

3.  OBJETIVO PRINCIPAL DA APLICAÇÃO

O principal fluxo da aplicação será a PRECIFICAÇÃO DE UM PRODUTO.

Quero conseguir selecionar:

Produto

Marketplace

E informar manualmente apenas:

Preço final de venda desejado

Valor do frete, somente quando aquela regra/marketplace exigir que ele
seja informado

Todo o restante deve ser obtido AUTOMATICAMENTE pela aplicação.

Exemplos:

custo;

regra fiscal;

substituição tributária;

impostos de entrada;

impostos de saída;

regra de precificação;

comissão do marketplace;

tarifa percentual;

tarifa fixa;

faixa de preço;

demais custos;

créditos tributários;

regras específicas daquele marketplace.

A aplicação deverá então calcular e apresentar, no mínimo:

Resultado financeiro

Preço de venda

Receita bruta

Tarifa percentual do marketplace em R\$

Tarifa fixa em R\$

Frete em R\$

Custo efetivo do produto

impostos/créditos relevantes

demais componentes relevantes da fórmula

Margem de contribuição líquida em R\$

Margem de contribuição em %

Quero também uma visão detalhada do cálculo, permitindo entender
claramente:

Preço de venda - custos - impostos - tarifas - frete = margem de
contribuição

Nada importante deve ficar escondido dentro de uma única fórmula opaca.

4.  CLASSIFICAÇÃO DA MARGEM

Utilizamos atualmente estas faixas como referência:

0% a 4,99% → RUIM

5% a 8,99% → ATENÇÃO

9% a 9,99% → ACEITÁVEL

10% ou mais → OK

Apresente visualmente essa classificação no resultado da precificação.

Esses limites NÃO devem ficar hardcoded permanentemente.

Crie uma configuração administrativa que permita alterar futuramente as
faixas e classificações.

5.  HISTÓRICO DE PRECIFICAÇÃO

Ao selecionar um produto para precificar, quero visualizar imediatamente
um resumo das últimas precificações realizadas para ele.

Exemplo:

Cada cálculo salvo deverá gerar um registro histórico.

O histórico precisa preservar um snapshot das regras utilizadas naquele
momento.

Isso é fundamental.

Se amanhã eu alterar:

comissão;

tarifa fixa;

imposto;

custo;

regra fiscal;

uma precificação realizada ontem NÃO pode ter seu histórico alterado
retroativamente.

Precisamos conseguir responder no futuro:

"Por que no dia X esse produto apresentava margem de 11,37%?"

Portanto, mantenha tanto:

referências aos cadastros;

quanto snapshot dos parâmetros utilizados no cálculo.

6.  FORNECEDORES

Preciso conseguir:

cadastrar fornecedor;

editar fornecedor;

visualizar fornecedor;

pesquisar fornecedor;

listar fornecedores;

ativar/desativar fornecedor.

Ao acessar um fornecedor, mostrar também:

quantidade de produtos;

produtos vinculados;

últimos produtos alterados;

outras informações relevantes.

A arquitetura NÃO deve reproduzir o modelo do Excel no qual cada
fornecedor precisa possuir uma aba diferente.

Fornecedor deve ser uma entidade normal no banco de dados.

7.  PRODUTOS

Preciso conseguir:

cadastrar novos produtos;

editar produtos existentes;

visualizar dados completos;

pesquisar por SKU;

pesquisar por código do fabricante;

pesquisar por nome;

filtrar por fornecedor;

filtrar por regra fiscal;

filtrar por marketplace quando aplicável;

ativar/desativar produtos.

O cadastro precisa comportar todos os dados necessários encontrados na
planilha de fabricantes.

Ao abrir um produto, quero uma página completa contendo seções como:

Dados gerais

SKU

Código fabricante

Produto

Fornecedor

custo

Dados fiscais

ST

ICMS entrada

PIS

COFINS

IPI

ICMS saída SP

ICMS saída Sul/Sudeste

ICMS saída Norte/Nordeste

regra fiscal

Dados por marketplace

Mostrar as configurações relevantes daquele produto para:

Mercado Livre

Shopee

Amazon

Histórico

últimas alterações no cadastro;

últimos reajustes de custo;

últimas precificações;

últimos preços praticados.

8.  PRODUTOS COM PREÇO REAJUSTADO

Preciso de uma funcionalidade para visualizar rapidamente os últimos
produtos que tiveram alteração/reajuste.

Exemplos:

custo alterado;

preço praticado alterado;

regra alterada;

tarifa relacionada alterada.

Quero conseguir ordenar por:

mais recente;

fornecedor;

marketplace;

SKU.

Idealmente o dashboard deve destacar produtos que podem exigir nova
análise de preço após alguma alteração relevante.

9.  MARKETPLACES

Marketplace deve ser uma entidade configurável.

Preciso conseguir:

visualizar marketplaces;

cadastrar novos marketplaces;

editar marketplace;

ativar/desativar marketplace.

Não construa o sistema inteiro com condicionais rígidas como:

if marketplace == Mercado Livre

if marketplace == Shopee

if marketplace == Amazon

Mercado Livre, Shopee e Amazon são os marketplaces iniciais, mas quero
que a arquitetura permita incluir outros no futuro.

10. REGRAS TARIFÁRIAS

Preciso conseguir administrar as regras tarifárias dos marketplaces.

Exemplos:

faixa mínima de preço;

faixa máxima de preço;

percentual da comissão;

cobrança fixa;

valor da cobrança fixa;

condições especiais;

regras diferentes dependendo do preço.

Exemplo conceitual:

Essas regras precisam ser configuráveis pelo painel administrativo.

Evite números mágicos espalhados pelo código.

11. VERSIONAMENTO DAS REGRAS

Tarifas de marketplace mudam com frequência.

Por isso, não quero simplesmente sobrescrever uma regra antiga.

Considere um modelo com:

versão;

data de início da vigência;

data de término da vigência;

marketplace;

regra;

usuário que alterou;

data da alteração.

Dessa maneira poderemos saber qual tarifa estava vigente em determinada
data.

12. MOTOR DE CÁLCULO

Este é um componente crítico.

As regras de cálculo precisam ficar separadas da interface.

Crie um domínio/módulo próprio para o motor de precificação.

Evite fórmulas espalhadas pelos componentes React ou controllers.

Quero algo conceitualmente semelhante a:

PricingEngine

Product

Marketplace

FiscalRule

MarketplaceFeeRule

ShippingRule

PricingInput

↓

PricingResult

O resultado deve fornecer tanto o resultado final quanto o detalhamento.

Exemplo:

PricingResult

salePrice

productCost

effectiveCost

marketplacePercentageFee

marketplaceFixedFee

shippingCost

taxes:

    icms

    pis

    cofins

    ipi

    ...

credits:

    ...

contributionMarginValue

contributionMarginPercent

classification

calculationBreakdown\[\]

Adapte essa estrutura conforme entender tecnicamente adequado.

13. REGRAS DE CÁLCULO SENSÍVEIS

Também preciso conseguir alterar as regras de cálculo futuramente.

Entretanto, isso deve ser tratado como uma área SENSÍVEL da aplicação.

Não quero que qualquer usuário consiga editar uma fórmula crítica
acidentalmente.

Implemente uma estrutura preparada para:

permissões;

confirmação adicional;

versionamento;

histórico;

auditoria;

identificação do usuário;

data/hora;

motivo da alteração;

possibilidade de comparar versão antiga × nova.

Não é necessário criar um sistema extremamente complexo de fórmulas
livres se isso prejudicar a segurança.

Priorize uma arquitetura segura e previsível.

14. AUDITORIA

Alterações importantes precisam gerar histórico.

Principalmente:

custo;

impostos;

produto;

fornecedor;

tarifa;

regra fiscal;

regra de cálculo;

preço praticado.

Registre pelo menos:

campo alterado;

valor anterior;

valor novo;

usuário;

data/hora.

15. INTERFACE

Quero uma experiência visual inspirada no ChatGPT atual:

extremamente limpa;

moderna;

poucos elementos desnecessários;

bastante espaço em branco;

navegação lateral;

boa hierarquia tipográfica;

foco no conteúdo;

rápida;

agradável para uso diário;

desktop-first, mas responsiva.

Não quero que pareça um ERP antigo.

Não quero telas cheias de caixas, bordas e informações competindo entre
si.

Utilize componentes consistentes.

Uma estrutura inicial poderia possuir uma sidebar como:

Início

Precificar

Produtos

Fornecedores

Marketplaces

Regras

Histórico

Configurações

16. TELA PRINCIPAL DE PRECIFICAÇÃO

Essa deve ser uma das telas mais refinadas da aplicação.

Quero algo extremamente simples.

Selecionar produto

Campo de busca inteligente por:

SKU;

código fabricante;

nome.

Depois:

Selecionar marketplace

Após selecionar produto + marketplace, a aplicação deve automaticamente
resolver:

fornecedor;

custo;

regra fiscal;

impostos;

regras tarifárias;

demais parâmetros.

O usuário informa:

Preço de venda

E, se necessário:

Frete

O resultado deve recalcular rapidamente.

Mostrar com grande destaque:

Margem líquida R\$ XX,XX

Margem de contribuição XX,XX%

Classificação OK / ACEITÁVEL / ATENÇÃO / RUIM

Abaixo:

Composição da margem

Exibir o cálculo detalhado.

Também quero um bloco:

Últimas precificações deste produto

Mostrando o histórico recente sem precisar sair da tela.

17. FUNCIONALIDADES E MELHORIAS DA ESPECIFICAÇÃO

Leia integralmente o item 17 do arquivo:

ESPECIFICACAO_PRECIFICACAO_MARKETPLACES.md

Implemente as funcionalidades e melhorias listadas ali.

Não ignore nenhum item silenciosamente.

18. DASHBOARD

Crie uma home útil, não apenas decorativa.

Algumas informações que podem ser relevantes:

últimos produtos precificados;

produtos recentemente alterados;

fornecedores;

marketplaces ativos;

produtos com margem abaixo do esperado;

produtos cujo custo mudou recentemente;

atalhos para "Nova Precificação";

últimas alterações importantes.

Priorize informações que ajudem a equipe a tomar decisões.

19. ARQUITETURA DE DADOS

Não replique literalmente a estrutura das planilhas.

Normalize adequadamente o banco.

Entidades esperadas provavelmente incluem algo próximo de:

Supplier

Product

ProductFiscalData

Marketplace

ProductMarketplaceConfig

MarketplaceFeeRule

FiscalRule

CalculationRule

PricingSimulation / PricingHistory

PricingSnapshot

MarginClassification

AuditLog

User

Esses nomes são sugestões.

Analise o domínio e proponha a melhor modelagem.

20. TECNOLOGIA

Se o projeto anexado não possuir stack definida, prefira uma arquitetura
web moderna e sustentável.

Minha preferência inicial é algo na linha de:

TypeScript

Next.js

React

PostgreSQL

ORM moderno

Tailwind

componentes de UI modernos

Supabase pode ser utilizado caso faça sentido para:

PostgreSQL;

autenticação;

permissões;

infraestrutura.

Supabase: você possui acesso ao projeto Supabase de desenvolvimento
conectado a este ambiente. Após definir a modelagem, crie e gerencie a
estrutura necessária do banco, migrations, relacionamentos, índices,
constraints, autenticação e políticas RLS. Não dependa de configuração
manual minha no dashboard quando isso puder ser realizado de forma
segura por você. Antes de alterações destrutivas ou de grande impacto,
valide o estado atual do banco. Trate este projeto Supabase como
ambiente de desenvolvimento. Mantenha todas as alterações de schema
reproduzíveis por migrations versionadas no GitHub.

# ATENÇÃO: Todas as tabelas expostas devem ter RLS apropriado, e a service_role/secret key jamais deve ir para o frontend.

21. VALIDAÇÃO DAS FÓRMULAS

Antes de considerar o motor de precificação correto, crie testes
automatizados utilizando exemplos reais encontrados nas planilhas.

Para cada combinação importante:

marketplace;

regra fiscal;

ST/não ST;

faixa tarifária;

pegue exemplos existentes no Excel.

Use os mesmos inputs no novo motor.

Compare:

Resultado Excel

vs

Resultado aplicação

Teste principalmente:

custo efetivo;

tarifas;

impostos;

margem líquida;

margem percentual.

Quero testes de regressão.

Uma alteração futura no código não pode mudar silenciosamente o
resultado financeiro.

22. DIVERGÊNCIAS JÁ IDENTIFICADAS

O Markdown documenta algumas anomalias importantes, entre elas
diferenças ou possíveis inconsistências envolvendo:

Amazon Nacional ST;

bases de PIS/COFINS;

tratamento de ST;

campos históricos;

campos que existem visualmente mas não entram na fórmula;

nomenclaturas inadequadas.

Elas já estão respondidas no próprio arquivo.

Não transforme automaticamente um possível erro da planilha em regra
permanente do novo sistema.

23. IMPORTAÇÃO DOS DADOS EXISTENTES

Mesmo que a primeira versão não tenha importação automatizada completa,
projete a aplicação considerando que posteriormente precisaremos migrar
os dados de:

PLANILHA PRECIFICAÇÃO POR FABRICANTE.xlsx

para o banco da aplicação.

Não quero ter que cadastrar manualmente todos os produtos existentes.

Portanto, já prepare uma estratégia para importação/migração.

24. O QUE NÃO QUERO

Não quero:

fórmulas financeiras espalhadas pelo frontend;

regras hardcoded sem necessidade;

valores mágicos no código;

arquitetura baseada exclusivamente nos 3 marketplaces atuais;

histórico que muda quando uma regra atual é alterada;

cálculos monetários com problemas de precisão;

banco copiando literalmente as colunas e abas do Excel;

UI semelhante a um ERP antigo;

cadastro excessivamente burocrático;

alterações em regras críticas sem auditoria;

esconder divergências encontradas nos arquivos.

25. PRIMEIRA FASE DO DESENVOLVIMENTO

Comece agora.

Primeiramente:

Etapa A --- Engenharia reversa

Analise os 3 arquivos anexados.

Valide o conteúdo do Markdown diretamente contra as fórmulas dos dois
Excel.

Crie no projeto uma documentação técnica resumindo:

regras confirmadas;

divergências;

decisões arquiteturais;

riscos.

Etapa B --- Modelagem

Defina:

entidades;

relacionamentos;

banco;

modelo de versionamento;

modelo de histórico;

arquitetura do motor de cálculo.

Etapa C --- Fundação da aplicação

Crie:

projeto;

banco;

migrations;

estrutura de domínio;

layout;

sidebar;

navegação;

componentes básicos.

Etapa D --- Cadastros essenciais

Implemente:

Fornecedores;

Produtos;

Marketplaces;

Regras tarifárias.

Etapa E --- Motor de precificação

Implemente as regras encontradas nos Excel.

Crie testes comparativos contra os resultados das planilhas.

Etapa F --- Tela Precificar

Implemente o principal fluxo:

Selecionar Produto

        ↓

Selecionar Marketplace

        ↓

Sistema recupera dados automaticamente

        ↓

Informar preço

        ↓

Informar frete, se necessário

        ↓

Calcular

        ↓

Margem R\$

Margem %

Classificação

Detalhamento

Histórico

Etapa G --- Histórico

Salve as precificações com snapshot das regras utilizadas.

26. FORMA DE TRABALHO

Não quero apenas um documento dizendo como o sistema poderia ser
desenvolvido.

Quero que você desenvolva efetivamente a aplicação.

Analise primeiro o suficiente para evitar decisões erradas e em seguida
implemente.

À medida que encontrar problemas ou ambiguidades:

documente;

escolha a alternativa arquitetural mais segura quando possível;

não invente regra financeira;

não bloqueie todo o desenvolvimento por detalhes que podem ser tratados
posteriormente;

me pergunte caso precise que eu tome alguma decisão.

Mantenha no projeto um arquivo semelhante a:

DECISOES_E_PENDENCIAS.md

onde sejam registradas:

divergências;

dúvidas fiscais;

decisões tomadas;

pontos que precisam ser validados comigo futuramente.

27. CRITÉRIO DE SUCESSO DA PRIMEIRA VERSÃO

Considerarei o primeiro grande marco bem-sucedido quando eu conseguir:

Abrir a aplicação.

Cadastrar ou selecionar um fornecedor.

Cadastrar ou selecionar um produto.

Visualizar seus dados fiscais.

Selecionar Mercado Livre, Shopee ou Amazon.

Informar o preço que desejo praticar.

Informar frete quando necessário.

Ter todo o restante preenchido automaticamente.

Receber margem de contribuição líquida em R\$ por cada região de ICMS.

Receber margem de contribuição em % por cada região de ICMS.

Entender exatamente como o cálculo chegou naquele resultado.

Ver a classificação da margem.

Ver a simulação do preço em tempo real

Salvar a precificação, se o usuário desejar.

Voltar posteriormente ao produto.

Visualizar o histórico das últimas precificações.

Alterar regras tarifárias através do painel administrativo.

Ter segurança de que o resultado calculado corresponde às regras
utilizadas atualmente nas planilhas.

28. COMECE AGORA

Faça primeiro a inspeção completa dos arquivos anexados.

Depois apresente de forma breve:

o que você confirmou;

divergências importantes encontradas;

arquitetura que será adotada;

estrutura inicial do banco;

sequência de implementação.

Em seguida, comece imediatamente a criar a aplicação no repositório,
priorizando a vertical completa mais importante:

Produto → Marketplace → Regras automáticas → Preço/Frete → Cálculo →
Margem → Histórico.

Não pare apenas na análise ou planejamento se já houver informações
suficientes para implementar.
