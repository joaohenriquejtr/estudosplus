# Estado atual

## Objetivo

Evoluir o EstudosPlus com IA de estudo, busca semântica, proficiência SRS, planos diários e sessões gamificadas, preservando autenticação, Supabase, vaults, wikilinks e notas existentes.

## Onde o trabalho parou

A Fase D foi implementada localmente e está pronta para validação/commit: o relógio foi extraído de `foco.tsx` e a rota `/study/session?noteId=...` foi criada. Ainda não foi publicada nesta atualização de memória.

## Feito

- Features 1–4: resumo, flashcards, preenchimento de stubs, chat socrático.
- Groq primário (`llama-3.3-70b-versatile`) com NVIDIA NIM fallback (`deepseek-ai/deepseek-v4`); Google removido do código.
- Retry de provedores, JSON mode e cache local.
- Jina embeddings + pgvector semântico adaptados para `content_cards`.
- SRS `topic_proficiency`, RPCs e avaliação Acertei/Errei nos flashcards.
- Fase C: `daily_plans`, geração idempotente e card básico no Dashboard.
- Fase D local: hook `usePomodoroTimer`, reutilização em Foco e sessão gamificada com flashcards/SRS.
- Commits publicados até `cf2f719`.

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

1. Validar, commitar e publicar a Fase D.
2. Depois implementar Fase E (análise de gaps para provas) usando `events`/`event_subjects` e adaptar a ausência de rota de detalhe de prova.

## Bloqueios ou hipóteses

- Variáveis remotas (`GROQ_API_KEY`, `NVIDIA_API_KEY`, `JINA_API_KEY`) não são verificáveis localmente sem acessar a Vercel; não registrar valores.
- As migrations precisam estar aplicadas no projeto Supabase para as features de pgvector, SRS e planos funcionarem.
- A especificação original usa `notes`/`exams`, mas o schema real usa `content_cards`/`events`; continuar usando o schema real.
