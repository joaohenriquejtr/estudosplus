# Histórico

## 2026-08-11
- Memória criada a pedido do usuário.
- Estado registrado no commit `cf2f719`: Fase C publicada; Fase D pendente.
- Registrado que Features 1–4, Groq/NVIDIA, Jina/pgvector e SRS já foram implementados.
- Registrado o próximo passo: extrair o Pomodoro de `foco.tsx` e criar a rota de sessão gamificada.

## 2026-08-12
- Fase D implementada localmente: criado `src/components/focus/usePomodoroTimer.ts` e atualizado `foco.tsx` para reutilizá-lo.
- Criada `src/routes/_authenticated/study.session.tsx` com Pomodoro, geração de flashcards, SRS, pausa ao revelar resposta e resumo final.
- Publicada em `1afe2f6` (`feat: add gamified study session`).
- Lint local tentou executar, mas foi bloqueado pelo Node incompatível com a `libc++` do macOS.
- Diagnosticada indisponibilidade de IA: o fallback NVIDIA usava `deepseek-ai/deepseek-v4`, identificador inexistente no endpoint NIM. Ajustado para `deepseek-ai/deepseek-v4-flash`, com logs seguros de status e mensagens específicas para falhas 401/403. Publicado em `e176770` (`fix: restore NVIDIA AI fallback`).
- Diagnosticada causa raiz persistente da indisponibilidade: `llm.server.ts` lia as chaves da Vercel no escopo do módulo. A configuração do próprio projeto indica que Nitro/Vite pode resolver esses valores como `undefined` nesse ponto. Leitura transferida para `callGroq` e `callNVIDIA`; publicada em `a7711e0` (`fix: read AI keys at request time`).
- Endurecido o runtime de IA em `8effe1b`: importação explícita de `node:process`, timeout via `AbortController` e tentativa da NVIDIA para qualquer falha da Groq. Erros de chave ausente, 401 e 403 agora são exibidos de forma diagnóstica e segura.
- Corrigido o fluxo do plano diário em `d5ff437`: adicionado carregamento do plano já salvo, feedback visual de erro/sucesso, validação de IDs retornados pela IA e item de fallback para evitar falha quando a resposta não contiver uma nota válida.

## 2026-08-10
- Fase C publicada em `cf2f719`: migration/API de `daily_plans` e card de geração no Dashboard.
- Fase D não foi iniciada para evitar deixar refatoração parcial do timer.

## 2026-08-09
- Publicadas as bases de Groq/NVIDIA, busca semântica e SRS nos commits `ab71d2b`, `674d204` e `cb3c02a`.
