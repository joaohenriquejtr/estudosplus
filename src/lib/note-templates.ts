import { BookOpen, CheckCircle2, File, FileText, GraduationCap, type LucideIcon } from "lucide-react";

export interface NoteTemplate {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Categoria da nota criada a partir deste template. */
  category: string;
  /** Corpo em Markdown. Suporta {{data_atual}}, {{nome_da_materia}} e {{titulo}}. */
  body: string;
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: "aula",
    name: "Aula",
    description: "Registro de aula com pontos importantes e dúvidas.",
    icon: GraduationCap,
    category: "anotacao",
    body: `# {{titulo}}

**Data:** {{data_atual}}  ·  **Matéria:** {{nome_da_materia}}

## Conteúdo


## Pontos importantes
- 

## Dúvidas
- [ ] 

## Links relacionados
[[ ]]
`,
  },
  {
    id: "resumo",
    name: "Resumo",
    description: "Tópicos, conceitos-chave e conexões entre matérias.",
    icon: FileText,
    category: "resumo",
    body: `# Resumo: {{titulo}}

## Tópicos principais
- 

## Conceitos-chave
- 

## Conexões com outras matérias
[[ ]]

## Resumo em 3 linhas
1. 
2. 
3. 
`,
  },
  {
    id: "exercicios",
    name: "Exercícios",
    description: "Enunciado, resolução, gabarito e dificuldade.",
    icon: CheckCircle2,
    category: "exercicio",
    body: `# Exercícios: {{titulo}}

## Enunciado


## Resolução


## Gabarito


## Dificuldade
- [ ] Fácil
- [ ] Médio
- [ ] Difícil

## Tags
#exercício #{{nome_da_materia}}
`,
  },
  {
    id: "fichamento",
    name: "Fichamento",
    description: "Fonte, citações, resumo do autor e sua reflexão.",
    icon: BookOpen,
    category: "material",
    body: `# Fichamento: {{titulo}}

**Fonte:** 

## Citação principal
> 

## Resumo do autor


## Minha reflexão


## Críticas / Dúvidas
- 
`,
  },
  {
    id: "livre",
    name: "Anotação livre",
    description: "Comece de uma página totalmente em branco.",
    icon: File,
    category: "anotacao",
    body: "",
  },
];

export const DEFAULT_TEMPLATE_ID = "aula";

export function renderTemplate(
  template: NoteTemplate,
  vars: { titulo: string; nome_da_materia: string },
): string {
  const data_atual = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const map: Record<string, string> = {
    data_atual,
    nome_da_materia: vars.nome_da_materia,
    titulo: vars.titulo || "Sem título",
    "título": vars.titulo || "Sem título",
  };
  return template.body.replace(/\{\{\s*([\wáéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ_]+)\s*\}\}/g, (full, key: string) =>
    key in map ? map[key] : full,
  );
}
