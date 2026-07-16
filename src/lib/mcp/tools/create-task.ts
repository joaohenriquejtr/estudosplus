import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_task",
  title: "Criar tarefa",
  description: "Cria uma nova tarefa para o usuário autenticado.",
  inputSchema: {
    title: z.string().trim().min(1),
    subject_id: z.string().uuid().optional(),
    due_date: z
      .string()
      .describe("Data de entrega em formato ISO (YYYY-MM-DD) ou timestamp.")
      .optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, subject_id, due_date, priority }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const { data, error } = await supabaseForUser(ctx)
      .from("tasks")
      .insert({
        user_id: ctx.getUserId()!,
        title,
        subject_id: subject_id ?? null,
        due_date: due_date ?? null,
        priority: priority ?? "medium",
      })
      .select()
      .single();
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Tarefa criada: ${data.title}` }],
      structuredContent: { task: data },
    };
  },
});
