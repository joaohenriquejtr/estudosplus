# Estado atual

## Objetivo

Evoluir o EstudosPlus com IA de estudo, busca semântica, proficiência SRS, planos diários e sessões gamificadas, preservando autenticação, Supabase, vaults, wikilinks e notas existentes.

## Onde o trabalho parou

A Fase E (gaps por tópicos) foi implementada localmente e aguarda publicação/aplicação das migrations. A CLI do Supabase foi instalada em `/Users/jr/.local/bin`, mas o binário atual não inicia neste macOS por incompatibilidade com a biblioteca do sistema.

## Feito

- Features 1–4: resumo, flashcards, preenchimento de stubs, chat socrático.
- Groq primário (`llama-3.3-70b-versatile`) com NVIDIA NIM fallback (`deepseek-ai/deepseek-v4-flash`); Google removido do código.
- Retry de provedores, JSON mode e cache local.
- Jina embeddings + pgvector semântico adaptados para `content_cards`.
- SRS `topic_proficiency`, RPCs e avaliação Acertei/Errei nos flashcards.
- Fase C: `daily_plans`, geração idempotente e card básico no Dashboard.
- Geração do plano diário reforçada em `d5ff437`: o painel recarrega planos salvos, exibe feedback de sucesso/erro e a IA só pode selecionar notas reais do usuário.
- Fase D publicada: hook `usePomodoroTimer`, reutilização em Foco e sessão gamificada com flashcards/SRS.
- Fase E implementada localmente: migration `exam_topics`, tópicos editáveis de prova, análise semântica por tópico, painel expansível no Calendário, criação de stubs e inclusão idempotente no plano diário.
- Commits publicados até `d5ff437`.
- Diagnóstico de IA: o fallback usava um modelo NVIDIA inexistente; o serviço agora remove espaços acidentais das chaves, registra apenas metadados seguros de falhas e mostra erros de autenticação/permissão mais úteis.
- Diagnóstico adicional de IA: apesar de estarem configuradas na Vercel, `GROQ_API_KEY` e `NVIDIA_API_KEY` podiam não chegar ao runtime porque eram lidas no escopo do módulo. `callGroq` e `callNVIDIA` agora fazem a leitura dentro das funções server-side.
- O serviço agora mostra uma mensagem específica se uma variável estiver ausente no runtime, a chave for recusada (401) ou o acesso ao modelo for negado (403), preservando os detalhes seguros no log do servidor.

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
- `src/lib/api/plans.functions.ts` — busca, geração e atualização de planos diários.
- `src/lib/api/exam-analysis.functions.ts` — extração, persistência e análise de tópicos de provas.
- `src/routes/_authenticated/calendar.tsx` — formulário de prova e painel expansível de gaps.
- Notas reais ficam em `content_cards`; a rota de nota é `/subjects/$id?note=$noteId`.
- Migrations recentes: `20260810090000_add_semantic_note_search.sql`, `20260810093000_add_topic_proficiency.sql`, `20260810100000_add_daily_plans.sql`.

## Como verificar

- `git status --short`
- `git log --oneline -5`
- `git diff --check`
- `npm run lint` / `npm run build` (o Node local anteriormente falhou por incompatibilidade nativa com `libc++`; confirmar novamente em ambiente funcional).
- Aplicar migrations no Supabase separadamente; deploy da Vercel não aplica migrations automaticamente.

## Próximos passos

1. Publicar a implementação da Fase E e aplicar as migrations pendentes com Supabase CLI em ambiente macOS compatível/autenticado: `supabase db push`.
2. Testar em produção o botão “Gerar meu plano de hoje”, criação de tópicos e o painel de análise de preparo.
3. Corrigir/atualizar o Node local para habilitar lint e build locais.

## Bloqueios ou hipóteses

- Variáveis remotas (`GROQ_API_KEY`, `NVIDIA_API_KEY`, `JINA_API_KEY`) não são verificáveis localmente sem acessar a Vercel; não registrar valores.
- `npm run lint` ainda não inicia localmente porque `/usr/local/bin/node` é incompatível com a `libc++` do macOS. A validação de compilação deve ocorrer na Vercel ou após corrigir o Node local.
- O Supabase CLI `2.114.0` instalado em `/Users/jr/.local/bin` também não inicia neste macOS (`___ulock_wait2` ausente), portanto não foi possível autenticar/vincular ou executar `supabase db push` daqui.
- As migrations precisam estar aplicadas no projeto Supabase para as features de pgvector, SRS e planos funcionarem.
- A especificação original usa `notes`/`exams`, mas o schema real usa `content_cards`/`events`; continuar usando o schema real.
