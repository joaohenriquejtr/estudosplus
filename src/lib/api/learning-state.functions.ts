import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadLearningStatesForUser } from "@/lib/study/learning-state.server";

const inputSchema = z.object({ subjectId: z.string().uuid().optional() });

/**
 * Returns deterministic, per-note learning facts for the current user. This
 * deliberately does not rank notes or invoke an AI provider.
 */
export const getLearningStates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(inputSchema)
  .handler(async ({ data, context }) => {
    return loadLearningStatesForUser(context.supabase as any, context.userId, data.subjectId);
  });
