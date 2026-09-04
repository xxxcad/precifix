# Precifix

Aplicação interna de precificação auditável para Mercado Livre, Shopee e Amazon. O motor financeiro usa aritmética decimal, calcula as três regiões fiscais e preserva snapshots de entradas, regras e resultados.

## Executar localmente

1. Instale as dependências com `pnpm install`.
2. Copie `.env.example` para `.env.local` e preencha a URL e a chave publicável do projeto Supabase.
3. Crie o primeiro usuário no Supabase Auth e promova seu registro em `public.profiles` para `admin`.
4. Execute `pnpm dev`.

Sem `.env.local`, a interface abre em modo demonstração e nenhuma gravação remota é realizada.

## Importação do catálogo

O fluxo é determinístico e auditável:

1. `pnpm catalog:extract` lê o arquivo mestre já analisado e gera `.analysis/master-catalog.json`.
2. `pnpm catalog:sql` calcula o SHA-256 do Excel e gera uma transação idempotente em `.analysis/catalog-import.sql`.
3. A transação cria o lote, fornecedores, produtos, configurações por marketplace, procedência por célula/linha e pendências de revisão.

Arquivos em `.analysis` contêm dados comerciais e permanecem fora do controle de versão.

## Qualidade

- `pnpm test`: regressão do motor de cálculo.
- `pnpm typecheck`: contratos TypeScript.
- `pnpm lint`: qualidade estática.
- `pnpm build`: build de produção.

As migrações versionadas ficam em `supabase/migrations`.
