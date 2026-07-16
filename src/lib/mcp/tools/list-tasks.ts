import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_tasks",
  title: "Listar tarefas",
  description:
    "Lista tarefas do usuário. Pode filtrar por status (pending, done) e matéria.",
  inputSchema: {
    status: z.enum(["pending", "done"]).optional(),
    subject_id: z.string().uuid().optional(),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ status, subject_id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    let q = supabaseForUser(ctx)
      .from("tasks")
      .select("id, title, priority, status, due_date, subject_id")
      .order("due_date", { ascending: true, nullsFirst: false });
    if (status) q = q.eq("status", status);
    if (subject_id) q = q.eq("subject_id", subject_id);
    const { data, error } = await q;
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { tasks: data },
    };
  },
});
