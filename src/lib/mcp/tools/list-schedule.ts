import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_schedule",
  title: "Cronograma semanal",
  description:
    "Lista o cronograma semanal fixo do usuário (aulas/atividades por dia da semana).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const { data, error } = await supabaseForUser(ctx)
      .from("schedule_slots")
      .select("id, weekday, start_time, end_time, title, notes, subject_id")
      .order("weekday")
      .order("start_time");
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { slots: data },
    };
  },
});
