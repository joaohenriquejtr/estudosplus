import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadLearningStatesForUser } from "@/lib/study/learning-state.server";
import { scoreLearningState } from "@/lib/study/priority-engine";
import { buildStudyPlan } from "@/lib/study/study-planner";

const inputSchema = z.object({
  availableMinutes: z.number().int().min(10).max(240).default(60),
  subjectId: z.string().uuid().optional(),
});

/** Returns a transient deterministic study plan; it never writes daily_plans. */
export const previewAdaptiveStudyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(inputSchema)
  .handler(async ({ data, context }) => {
    const states = await loadLearningStatesForUser(context.supabase as any, context.userId, data.subjectId);
    const ranking = states.map((state) => ({ state, priority: scoreLearningState(state) }));
    return buildStudyPlan(ranking, { availableMinutes: data.availableMinutes });
  });
