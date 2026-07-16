import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_upcoming_events",
  title: "Próximas provas e datas",
  description: "Lista os próximos eventos (provas, entregas, etc.) do usuário.",
  inputSchema: {
    days_ahead: z.number().int().min(1).max(365).optional(),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ days_ahead }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const today = new Date();
    const until = new Date();
    until.setDate(today.getDate() + (days_ahead ?? 30));
    const { data, error } = await supabaseForUser(ctx)
      .from("events")
      .select("id, title, event_date, event_type, notes, subject_id")
      .gte("event_date", today.toISOString().slice(0, 10))
      .lte("event_date", until.toISOString().slice(0, 10))
      .order("event_date");
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { events: data },
    };
  },
});
