# Sistema de Contas e Compartilhamento

## Visão geral

Migrar do IndexedDB local para uma biblioteca persistente vinculada à conta do usuário, e adicionar páginas públicas de visualizador acessíveis por link.

## Fluxos novos

1. **Visitar `/`** sem login → continua mostrando o menu; ao clicar em qualquer ação que exija dados (criar/salvar/biblioteca), o app pede login.
2. **`/auth`** → tela única com abas "Entrar" e "Criar conta" (e-mail + senha).
3. **Logado** → header global mostra e-mail do usuário e botão "Sair".
4. **Biblioteca, criadores e visualizador** ficam atrás de `_authenticated/`.
5. **Mestre cria/salva um visualizador** → ganha botão "Copiar link público" que gera `/v/<slug>-<id6>`.
6. **Jogador abre o link** → carrega só o cenário/dispositivo do mestre, sem header, sem menus, sem biblioteca. Mantém o botão "Inserir Mídia" (jogador insere seu próprio `.archive`).

## Mudanças de dados

Tabelas novas no banco da Lovable Cloud (todas com RLS):

- `archives` — metadados de cada arquivo (id, owner_id, kind, name, description, format, autoplay, loop, compatible_viewers, token_path, payload_path, payload_mime, timestamps).
- `viewers` — metadados de cada visualizador (id, owner_id, slug, name, accepts, controls, resolution, background_path, token_path, sounds (jsonb com paths), is_public default true, timestamps). Slug único por owner; URL pública usa `<slug>-<id6>` para ser único globalmente.

Storage buckets:

- `archive-files` (privado) — vídeos/áudios/imagens/tokens dos arquivos.
- `viewer-assets` (público) — background, token e sons dos visualizadores (servem páginas públicas de jogador).

Políticas RLS:

- `archives`: owner faz CRUD do seu; ninguém mais lê.
- `viewers`: owner faz CRUD do seu; `anon` e `authenticated` podem `SELECT` quando `is_public = true` (para a página `/v/...`).

## Camada de acesso

Substituir `src/lib/archive/db.ts` e `viewer-db.ts` por funções que falam com a Cloud:

- `listArchives`, `getArchive`, `saveArchive`, `deleteArchive` → tabela `archives` + bucket privado, com URLs assinadas para tocar/baixar.
- `listViewers`, `getViewer`, `saveViewer`, `deleteViewer` → tabela `viewers` + bucket público.
- `getPublicViewer(slug)` → leitura anônima por slug, usado pela página do jogador.

Os componentes existentes (`biblioteca`, `criador/visualizador`, `visualizador`) continuam consumindo a mesma API; só a implementação interna muda. Blobs viram URLs (`URL.createObjectURL` é substituído pelo `publicUrl`/`signedUrl` do storage).

## Rotas

- `src/routes/auth.tsx` — login/cadastro/logout (pública).
- `src/routes/_authenticated/route.tsx` — gate gerenciado da integração.
- Mover: `biblioteca.tsx`, `criar.tsx`, `criador.visualizador.tsx`, `criador.video.tsx`, `visualizador.tsx`, `configuracoes.tsx` → para `src/routes/_authenticated/`.
- `src/routes/v.$slug.tsx` — página pública do jogador (sem `NoirShell`, sem nav, só o dispositivo + "Inserir Mídia").
- `/` permanece pública.

## UI

- Header de `NoirShell` ganha botão "Sair" + e-mail (quando logado).
- Card do visualizador na biblioteca ganha botão "Copiar link" que mostra `/<origin>/v/<slug>-<id6>` e copia para o clipboard.
- Tela do criador, depois de "Salvar", mostra o link público pronto pra copiar.

## Detalhes técnicos

- Auth: email/senha via `supabase.auth.signUp` / `signInWithPassword`; `emailRedirectTo: window.location.origin`. Email confirmation desativado pra evitar fricção em testes.
- `_authenticated/route.tsx` usa o template gerenciado da integração (`ssr: false`, redirect para `/auth`).
- A página `/v/$slug` é SSR-on, leitura anônima via cliente publishable + política `is_public = true`.
- Imports de `supabase` apenas pelo cliente browser; nada de service role no caminho do jogador.
- Migração de dados antigos do IndexedDB: NÃO fazemos automaticamente — `configuracoes` ganha um botão "Importar do armazenamento local" que percorre o IDB e faz upload para a conta. (Opcional; podemos cortar se quiser ainda mais enxuto.)

## Fora do escopo desta entrega

- Login social (Google/Apple) — fica pra depois.
- Perfil de usuário com nome/avatar.
- Reset de senha por e-mail (podemos adicionar em seguida; precisa rota `/reset-password`).
- Editor de cena visual do visualizador (já estava marcado "em breve").
