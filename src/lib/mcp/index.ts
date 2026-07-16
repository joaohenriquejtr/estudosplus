import { auth, defineMcp } from "@lovable.dev/mcp-js";

import listSubjectsTool from "./tools/list-subjects";
import listTasksTool from "./tools/list-tasks";
import createTaskTool from "./tools/create-task";
import listUpcomingEventsTool from "./tools/list-upcoming-events";
import listScheduleTool from "./tools/list-schedule";

const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "estudo-plus-mcp",
  title: "Estudo+",
  version: "0.1.0",
  instructions:
    "Ferramentas para o Estudo+: consultar matérias, tarefas, cronograma semanal e próximas provas/datas do usuário autenticado, e criar novas tarefas.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listSubjectsTool,
    listTasksTool,
    createTaskTool,
    listUpcomingEventsTool,
    listScheduleTool,
  ],
});
