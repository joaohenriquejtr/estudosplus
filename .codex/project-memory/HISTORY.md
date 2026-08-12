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

## 2026-08-10
- Fase C publicada em `cf2f719`: migration/API de `daily_plans` e card de geração no Dashboard.
- Fase D não foi iniciada para evitar deixar refatoração parcial do timer.

## 2026-08-09
- Publicadas as bases de Groq/NVIDIA, busca semântica e SRS nos commits `ab71d2b`, `674d204` e `cb3c02a`.
