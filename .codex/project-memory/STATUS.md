# Estado atual

## Objetivo

Evoluir o EstudosPlus com IA de estudo, busca semântica, proficiência SRS, planos diários e sessões gamificadas, preservando autenticação, Supabase, vaults, wikilinks e notas existentes.

## Onde o trabalho parou

A Fase D foi publicada no commit `1afe2f6`. A correção do fallback de IA foi publicada no commit `e176770`: o identificador NVIDIA inválido `deepseek-ai/deepseek-v4` foi trocado por `deepseek-ai/deepseek-v4-flash`.

## Feito

- Features 1–4: resumo, flashcards, preenchimento de stubs, chat socrático.
- Groq primário (`llama-3.3-70b-versatile`) com NVIDIA NIM fallback (`deepseek-ai/deepseek-v4-flash`); Google removido do código.
- Retry de provedores, JSON mode e cache local.
- Jina embeddings + pgvector semântico adaptados para `content_cards`.
- SRS `topic_proficiency`, RPCs e avaliação Acertei/Errei nos flashcards.
- Fase C: `daily_plans`, geração idempotente e card básico no Dashboard.
- Fase D publicada: hook `usePomodoroTimer`, reutilização em Foco e sessão gamificada com flashcards/SRS.
- Commits publicados até `e176770`.
- Diagnóstico de IA: o fallback usava um modelo NVIDIA inexistente; o serviço agora remove espaços acidentais das chaves, registra apenas metadados seguros de falhas e mostra erros de autenticação/permissão mais úteis.

## Arquivos e áreas relevantes

- `src/lib/ai/llm.ts` — contratos, prompts e cache cliente.
- `src/lib/ai/llm.server.ts` — chamadas Groq/NVIDIA server-side.
- `src/lib/ai/embeddings.server.ts`, `src/lib/ai/context.server.ts` — Jina/RAG.
- `src/lib/api/ai.functions.ts`, `embeddings.functions.ts`, `plans.functions.ts` — Server Functions.
- `src/lib/study/proficiency.ts` — SRS.
- `src/routes/_authenticated/foco.tsx` — Pomodoro atual, ainda acoplado à página.
- `src/components/focus/usePomodoroTimer.ts` — relógio compartilhado extraído do Foco.
- `src/routes/_authenticated/study.session.tsx` — sessão gamificada.
- `src/components/focus/TimerRing.tsx` e `useFocusSettings.ts` — peças reutilizáveis do timer.
- `src/routes/_authenticated/dashboard.tsx` — Dashboard e plano diário.
- Notas reais ficam em `content_cards`; a rota de nota é `/subjects/$id?note=$noteId`.
- Migrations recentes: `20260810090000_add_semantic_note_search.sql`, `20260810093000_add_topic_proficiency.sql`, `20260810100000_add_daily_plans.sql`.

## Como verificar

- `git status --short`
- `git log --oneline -5`
- `git diff --check`
- `npm run lint` / `npm run build` (o Node local anteriormente falhou por incompatibilidade nativa com `libc++`; confirmar novamente em ambiente funcional).
- Aplicar migrations no Supabase separadamente; deploy da Vercel não aplica migrations automaticamente.

## Próximos passos

1. Publicar e testar em produção a correção do fallback de IA, verificando um resumo e flashcards.
2. Aplicar as migrations pendentes no Supabase e testar a sessão em produção.
3. Depois implementar Fase E (análise de gaps para provas) usando `events`/`event_subjects` e adaptar a ausência de rota de detalhe de prova.

## Bloqueios ou hipóteses

- Variáveis remotas (`GROQ_API_KEY`, `NVIDIA_API_KEY`, `JINA_API_KEY`) não são verificáveis localmente sem acessar a Vercel; não registrar valores.
- `npm run lint` ainda não inicia localmente porque `/usr/local/bin/node` é incompatível com a `libc++` do macOS. A validação de compilação deve ocorrer na Vercel ou após corrigir o Node local.
- As migrations precisam estar aplicadas no projeto Supabase para as features de pgvector, SRS e planos funcionarem.
- A especificação original usa `notes`/`exams`, mas o schema real usa `content_cards`/`events`; continuar usando o schema real.
