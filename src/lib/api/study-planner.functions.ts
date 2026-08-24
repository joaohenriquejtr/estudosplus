import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadLearningStatesForUser } from "@/lib/study/learning-state.server";
import { scoreLearningState, scoreMissingReference } from "@/lib/study/priority-engine";
import { buildStudyPlan } from "@/lib/study/study-planner";
import { getExamPrioritySignal } from "@/lib/study/exam-signals";
import { loadUpcomingExamsForUser } from "@/lib/study/exam-signals.server";
import { loadMissingWikiReferencesForUser } from "@/lib/study/wiki-gaps.server";

const inputSchema = z.object({
  availableMinutes: z.number().int().min(10).max(240).default(60),
  subjectId: z.string().uuid().optional(),
});

/** Returns a transient deterministic study plan; it never writes daily_plans. */
export const previewAdaptiveStudyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(inputSchema)
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const [states, missingReferences, upcomingExams] = await Promise.all([
      loadLearningStatesForUser(db, context.userId, data.subjectId),
      loadMissingWikiReferencesForUser(db, context.userId, data.subjectId),
      loadUpcomingExamsForUser(db, context.userId),
    ]);
    const ranking = states.map((state) => {
      const examSignal = getExamPrioritySignal(state.subjectId, upcomingExams);
      return {
        state,
        priority: scoreLearningState(state, examSignal ? { relatedExamDays: examSignal.relatedExamDays } : {}),
      };
    });
    const priorityByNoteId = new Map(ranking.map((entry) => [entry.state.noteId, entry.priority]));
    const missingReferenceRanking = missingReferences.map((reference) => ({
      candidate: reference,
      priority: scoreMissingReference({
        title: reference.title,
        referenceCount: reference.referenceCount,
        inActiveStudyCycle: reference.sourceNoteIds.some((noteId) => priorityByNoteId.get(noteId)?.shouldRecommend),
        relatedExamDays: getExamPrioritySignal(reference.subjectId, upcomingExams)?.relatedExamDays,
      }),
    }));
    return buildStudyPlan(ranking, { availableMinutes: data.availableMinutes }, missingReferenceRanking);
  });
