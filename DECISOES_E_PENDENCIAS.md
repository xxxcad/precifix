# Decisões e pendências

## Confirmado diretamente nos arquivos

- O cadastro mestre possui 25 abas, sendo 24 fornecedores e uma aba vazia (`Planilha1`). A importação deve usar cabeçalhos, não posições fixas.
- A calculadora possui 16 abas. `Amazon Nacional st` é a duplicata legada descartada; as 15 demais formam três marketplaces × cinco perfis fiscais.
- Mercado Livre usa comissão percentual, frete e impostos; o campo legado `FIXO` não entra no cálculo e não será usado.
- Shopee usa 20% + R$ 4 abaixo de R$ 80; 14% + R$ 16 de R$ 80 a R$ 99,99; 14% + R$ 20 de R$ 100 a R$ 199,99; e 14% + R$ 26 a partir de R$ 200.
- Em ST, o valor monetário de ST compõe o custo efetivo. Em regras normais, ICMS, PIS e COFINS de entrada geram créditos; IPI é adicionado.
- PIS e COFINS de saída ficam zerados permanentemente no cenário atual.
- A margem de exatamente 10,00% recebe a classificação `OK`.

## Divergências preservadas como legado, não como regra oficial

- As abas Amazon sem ST calculam PIS/COFINS sobre o custo bruto. A decisão aprovada é usar `custo - crédito de ICMS`, igual aos demais marketplaces. O motor oficial aplica a correção; a função legada existe apenas para reconciliação e testes.
- O total informativo de créditos ST varia entre marketplaces, mas não altera a margem. O indicador não será exibido como métrica oficial.
- A linha chamada “frete” na Shopee deduz a tarifa fixa. Na aplicação o componente se chama `tarifa fixa`.
- Margens armazenadas no cadastro mestre são snapshots históricos e nunca serão fonte oficial do novo cálculo.

## Arquitetura adotada

- Next.js App Router + TypeScript, com interface React e motor de domínio independente.
- `decimal.js` com precisão 32 e arredondamento HALF_UP; entradas e saídas financeiras são serializadas como strings decimais.
- PostgreSQL/Supabase normalizado: fornecedores, produtos, marketplaces, configurações do produto, versões tarifárias, versões do motor, classificações, histórico imutável, fila de reprecificação e auditoria.
- Regras comerciais são adapters por capacidade (`price_band`, `percentage`, `percentage_listing`), não condicionais espalhadas pela interface.
- Cada precificação salva guarda referências e snapshots completos de entradas, regra e resultados por região.
- Tabelas expostas usam RLS; leitura é interna para usuários autenticados, operação diária requer `analyst` ou `admin`, e alterações críticas exigem `admin`.

## Incremento de integração concluído

- Importador por cabeçalhos concluído para as 24 abas de fornecedores: 287 registros reconhecidos e 285 prontos para carga.
- O SKU `1142` possui duas ocorrências e o SKU `1320` não informa regra fiscal; ambos ficam fora do catálogo até resolução explícita.
- 82 linhas parciais/formatadas são preservadas como pendências de origem e não viram produtos incompletos.
- Lotes de importação usam SHA-256, versão do importador, procedência por aba/linha e fila de pendências com RLS restrita a `analyst` e `admin`.
- Login, renovação de sessão, logout, leitura do catálogo, gravação server-side do snapshot, histórico, cadastros básicos e fila de reprecificação estão conectados ao Supabase com fallback de demonstração.
- A migração `catalog_import_audit` e a carga comercial foram aplicadas no projeto `pricing-hannover-dev`: 24 fornecedores, 285 produtos, 855 configurações por marketplace, 285 registros de origem e 84 pendências auditáveis.
- Os SKUs `1142` e `1320` continuam bloqueados e não foram importados como produtos; as respectivas inconsistências permanecem registradas para resolução.
- O acesso administrativo passou a usar e-mail e senha. A conta `hannoverhome4@gmail.com` está confirmada, ativa e validada com a função `admin`.
- O auto cadastro por link foi removido da interface. Administradores cadastram novos usuários em Configurações → Usuários, informando nome, e-mail, senha inicial e função (`viewer`, `analyst` ou `admin`).
- A criação de usuários ocorre pela Edge Function `admin-users`, com JWT obrigatório, validação adicional do perfil administrativo e chave privilegiada restrita ao servidor do Supabase.
- A simulação aceita preço/frete ou margem-alvo e calcula o menor preço necessário por região e faixa tarifária.
- Alterações em custo, parâmetros fiscais, comissão, frete ou tarifas criam automaticamente uma pendência única de reprecificação; itens resolvidos permanecem no histórico.
- Produtos possuem edição, status Ativo/Extinto e histórico de custo por usuário; fornecedores possuem edição e logo privado no Storage.
- Regras tarifárias foram incorporadas à administração de Marketplaces; a rota antiga `/regras` apenas redireciona.

## Riscos e validações futuras

- Confirmar as comissões atuais por categoria/anúncio de Mercado Livre e Amazon antes do go-live; a planilha de fabricantes contém valores por produto.
- A constraint que relaciona valor de ST ao perfil fiscal foi criada como `NOT VALID` para permitir importação e relatório de inconsistências antes de bloquear dados legados.
- A prévia Custo anterior → Custo novo → impacto na margem continua como evolução de interface; o importador e a fila de inconsistências já estão prontos.
- Ativar a proteção contra senhas vazadas nas configurações do Supabase Auth antes do go-live.

## Item 17 — cobertura do primeiro marco

- Implementado no motor/tela: preço-alvo, equilíbrio, mínimo aceitável, comparação por regiões, simulação em tempo real, cenários de preço, explicabilidade e classificação visual.
- Preparado no banco: histórico de custo/preço, preço mínimo, fila de reprecificação, regras versionadas, alertas/exceções e cálculo em lote.
- Próximo incremento de interface: edição completa de produto/configuração por canal, prévia visual da importação e sensibilidade editável de custo/frete/comissão.
