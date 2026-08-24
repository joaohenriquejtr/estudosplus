import type { LearningState } from "./learning-state";
import type { PriorityEvidence, PriorityResult, StudyAction } from "./priority-engine";

export type PlannedStudyItem = {
  noteId: string;
  subjectId: string;
  title: string;
  action: StudyAction;
  estimatedMinutes: number;
  priority: Pick<PriorityResult, "score" | "level">;
  evidence: PriorityEvidence[];
  dataAvailability: LearningState["dataAvailability"];
};

export type StudyPlanStatus = "ready" | "limited_data" | "no_urgent_priorities";

export type StudyPlan = {
  status: StudyPlanStatus;
  availableMinutes: number;
  estimatedMinutes: number;
  items: PlannedStudyItem[];
  message: string;
};

export type RankedLearningState = {
  state: LearningState;
  priority: PriorityResult;
};

export type StudyPlannerOptions = {
  availableMinutes: number;
  maxItems?: number;
  minimumItemMinutes?: number;
};

/** One source of truth for the initial time estimates shown to the student. */
export const DEFAULT_ACTION_MINUTES: Record<StudyAction, number> = {
  CONSTRUIR: 20,
  CONSOLIDAR: 20,
  PRATICAR: 15,
  REVISAR: 15,
  RECUPERAR: 20,
  EXPLORAR: 15,
};

const DEFAULT_MAX_ITEMS = 5;

function messageFor(status: StudyPlanStatus): string {
  if (status === "limited_data") return "Ainda estamos conhecendo seu ritmo. Este plano usa os dados de estudo já registrados.";
  if (status === "no_urgent_priorities") return "Seu desempenho está estável no momento. Você pode escolher qualquer conteúdo que queira aprofundar.";
  return "Estas sugestões foram ordenadas por evidências reais do seu estudo. Você decide o que seguir, adiar ou trocar.";
}

/**
 * Builds a voluntary, multi-item session from a deterministic ranking.
 * It deliberately does not create or persist a daily plan; that integration comes later.
 */
export function buildStudyPlan(
  rankedStates: RankedLearningState[],
  options: StudyPlannerOptions,
): StudyPlan {
  const availableMinutes = Math.max(0, Math.floor(options.availableMinutes));
  const maxItems = Math.max(1, options.maxItems ?? DEFAULT_MAX_ITEMS);
  const minimumItemMinutes = Math.max(1, options.minimumItemMinutes ?? 10);
  const candidates = rankedStates
    .filter(({ priority }) => priority.shouldRecommend && priority.action !== null)
    .slice()
    .sort((left, right) => right.priority.score - left.priority.score || left.state.title.localeCompare(right.state.title, "pt-BR"));

  const items: PlannedStudyItem[] = [];
  let estimatedMinutes = 0;
  for (const { state, priority } of candidates) {
    if (!priority.action || items.length >= maxItems) break;
    const suggestedMinutes = DEFAULT_ACTION_MINUTES[priority.action];
    const remainingMinutes = availableMinutes - estimatedMinutes;
    if (remainingMinutes < minimumItemMinutes) break;

    items.push({
      noteId: state.noteId,
      subjectId: state.subjectId,
      title: state.title,
      action: priority.action,
      estimatedMinutes: Math.min(suggestedMinutes, remainingMinutes),
      priority: { score: priority.score, level: priority.level },
      evidence: priority.evidence,
      dataAvailability: state.dataAvailability,
    });
    estimatedMinutes += Math.min(suggestedMinutes, remainingMinutes);
  }

  const status: StudyPlanStatus = items.length === 0
    ? "no_urgent_priorities"
    : items.every((item) => item.dataAvailability === "limited")
      ? "limited_data"
      : "ready";
  return { status, availableMinutes, estimatedMinutes, items, message: messageFor(status) };
}
