import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadLearningStatesForUser } from "@/lib/study/learning-state.server";
import { scoreLearningState } from "@/lib/study/priority-engine";

const inputSchema = z.object({ subjectId: z.string().uuid().optional() });

/**
 * Exposes the current deterministic ranking. Exam, graph and doubt signals are
 * intentionally added in later stages only once those facts are persisted.
 */
export const getPriorityRanking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(inputSchema)
  .handler(async ({ data, context }) => {
    const states = await loadLearningStatesForUser(context.supabase as any, context.userId, data.subjectId);
    return states
      .map((state) => ({ state, priority: scoreLearningState(state) }))
      .sort((left, right) => right.priority.score - left.priority.score || left.state.title.localeCompare(right.state.title, "pt-BR"));
  });
