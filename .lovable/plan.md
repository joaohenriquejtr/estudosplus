## Análise geral do Estudo+

O app está funcional e coerente na camada de dados (React Query + backend em todas as telas). As inconsistências estão em UX, mobile e padronização visual.

### Problemas de uso em celular (prioridade alta)
1. **Botões de editar/excluir invisíveis no toque.** Em Matérias (lista) e nos conteúdos de uma matéria, as ações só aparecem no hover — em celular não existe hover, então ficam inacessíveis.
2. **Linha de tarefa estoura na largura.** Cada tarefa é uma única linha com checkbox + título + seletor de status + 2 botões; em telas estreitas o título comprime a quase nada (e o `overflow-x-hidden` do layout esconde o problema em vez de resolvê-lo).
3. **Abas do editor de conteúdo (Digitar/Colar/Link/Upload)** usam 4 colunas fixas e truncam em tela pequena.
4. **Cronograma**: 7 dias empilhados, a maioria vazia, sem colapsar dias sem aula — scroll longo no celular.

### Confusões de fluxo
5. **Matérias podem ser criadas em dois lugares** (Configurações e Matérias), com formulários diferentes — em Configurações não dá para escolher a cor, gerando matérias inconsistentes.
6. **"Próximas provas" no Painel lista também trabalhos, apresentações e "outros"** — o rótulo engana.
7. **Tarefas vs Provas & Datas**: um "trabalho com prazo" cabe nas duas abas e nada na interface explica a diferença.
8. **Capítulos vs Categorias** convivem como dois filtros lado a lado com a mesma finalidade aparente, sem hierarquia explicada.
9. **Confirmações de exclusão usam o popup nativo do navegador** em 6 telas, quebrando a estética do app.
10. **Textos inconsistentes**: "Removida" / "Removido" / "Capítulo removido"; menções a "Obsidian" em dicas para usuário leigo.

### Inconsistência visual
11. **Três padrões de cabeçalho de página**: com ícone (Cronograma, Grafo), só título (Matérias, Tarefas, Provas, Configurações), e sem título nenhum (Painel).
12. **Quatro padrões de botões de ação**: hover-fade, opacidade fixa, sempre visível inline, e overlay flutuante (Cronograma).
13. **Estados vazios diferentes** em cada tela (uns com ícone e instrução, outros só uma frase).
14. **Sem estados de carregamento**: durante o carregamento o app mostra "Nenhuma tarefa." — parece que não há dados.
15. **Erros de leitura são silenciosos** (só as gravações mostram aviso).

### Acessibilidade e SEO
16. Botão de excluir matéria sem rótulo acessível; ações de capítulo usam `span` em vez de botão real; nós do grafo não são acessíveis por teclado.
17. Título da página de uma matéria é sempre "Matéria — Estudo+", não o nome real. Nenhuma rota tem `description`/Open Graph próprios (relevante para `/auth`, a página compartilhável).

---

## Plano de correção proposto (em ordem)

**Fase 1 — Mobile e clareza (impacto imediato)**
- Ações de editar/excluir sempre visíveis no mobile (hover só no desktop) em Matérias e conteúdos.
- Reestruturar a linha de tarefa para empilhar em telas estreitas (título em cima, status + ações abaixo) e remover a dependência do `overflow-x-hidden`.
- Abas do editor de conteúdo em 2x2 no mobile.
- Renomear "Próximas provas" para "Próximos compromissos" (ou filtrar de fato só provas — a definir).

**Fase 2 — Padronização**
- Componente único de cabeçalho de página (ícone + título + subtítulo) aplicado às 7 telas, incluindo o Painel.
- Componente `EmptyState` reutilizável e um padrão único de skeleton de carregamento.
- Substituir os 6 `confirm()` nativos por diálogo de confirmação do design system.
- Padronizar os textos de toast e os termos em pt-BR.

**Fase 3 — Fluxo e detalhes**
- Remover o cadastro de matérias de Configurações, deixando apenas um link para a aba Matérias (fluxo único).
- Mensagem de erro visível quando uma leitura falha.
- Rótulos acessíveis faltantes, `button` real nas ações de capítulo, navegação por teclado no grafo.
- Título dinâmico da página da matéria + `description`/OG nas rotas públicas.
- Texto de ajuda explicando Capítulo (divisão do conteúdo) vs Categoria (tipo do material), e uma linha explicando quando usar Tarefa vs Prova/Data.

### Detalhes técnicos
Arquivos afetados: `src/routes/_authenticated/{dashboard,subjects.index,subjects.$id,tasks,calendar,schedule,graph,settings}.tsx`, `src/components/AppShell.tsx`, novos `src/components/PageHeader.tsx`, `src/components/EmptyState.tsx`, `src/components/ConfirmDialog.tsx`. Nenhuma mudança de banco de dados é necessária.

Se preferir, posso executar apenas a Fase 1 primeiro.
