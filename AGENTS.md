# Fluxo obrigatório de desenvolvimento e deploy

Estas regras são permanentes e devem ser seguidas em qualquer alteração deste projeto.

## Código e branches

- O repositório GitHub é a fonte oficial do código.
- Nunca desenvolver novas funcionalidades diretamente na branch `main`.
- Para novas funcionalidades, utilizar branches `feature/*`.
- Para correções, utilizar branches `fix/*`.
- Todo código deve ser commitado antes de qualquer deploy.
- A branch `main` representa o ambiente de produção.

## Preview e produção

- Branches diferentes da `main` devem ser utilizadas como ambiente de Preview na Vercel.
- Toda alteração deve ser testada no Preview Deployment antes do merge para `main`.
- Não realizar deploy de código local não commitado.
- Não promover alterações para produção sem aprovação dos critérios de verificação abaixo.

## Segurança

- Nunca inserir secrets, tokens, senhas, chaves privadas ou Supabase Service Role Keys no código-fonte.
- Nunca incluir credenciais em commits, logs, exemplos, fixtures ou arquivos versionados.
- Utilizar variáveis de ambiente próprias para cada ambiente.

## Supabase

- Alterações estruturais do Supabase devem ser realizadas por migrations versionadas e commitadas.
- Evitar migrations destrutivas sem estratégia explícita de compatibilidade e rollback.
- Manter aplicação e banco compatíveis durante o Preview e a transição para produção.

## Verificação obrigatória antes do merge para `main`

- Build de produção.
- Verificação de erros TypeScript.
- Lint.
- Funcionamento das principais telas.
- Autenticação.
- Operações com o banco de dados.
- Permissões e políticas de acesso.

## Conduta operacional

- Antes de iniciar uma alteração, confirmar a branch atual.
- Se estiver na `main`, criar uma branch `feature/*` ou `fix/*` apropriada antes de editar.
- Antes do deploy, confirmar que não há alterações locais sem commit.
- Validar o Preview Deployment e somente depois preparar o merge para `main`.

## Pendência atual

- A pasta local ativa ainda não possui um diretório `.git`. Antes do próximo desenvolvimento ou deploy, conectar esta pasta ao repositório GitHub oficial ou substituir a pasta por um clone válido do repositório.
