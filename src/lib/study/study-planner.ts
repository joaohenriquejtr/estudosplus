import type { LearningState } from "./learning-state";
import type { MissingReferenceCandidate, PriorityEvidence, PriorityResult, StudyAction } from "./priority-engine";

export type PlannedStudyItem = {
  kind: "note" | "missing_reference";
  noteId: string | null;
  subjectId: string;
  title: string;
  action: StudyAction;
  estimatedMinutes: number;
  priority: Pick<PriorityResult, "score" | "level">;
  evidence: PriorityEvidence[];
  dataAvailability: LearningState["dataAvailability"];
  sourceNoteIds?: string[];
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

export type RankedMissingReference = {
  candidate: MissingReferenceCandidate & { subjectId: string; sourceNoteIds: string[] };
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

type PlannerCandidate =
  | { kind: "note"; state: LearningState; priority: PriorityResult }
  | { kind: "missing_reference"; candidate: RankedMissingReference["candidate"]; priority: PriorityResult };

function candidateTitle(candidate: PlannerCandidate): string {
  return candidate.kind === "note" ? candidate.state.title : candidate.candidate.title;
}

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
  rankedMissingReferences: RankedMissingReference[] = [],
): StudyPlan {
  const availableMinutes = Math.max(0, Math.floor(options.availableMinutes));
  const maxItems = Math.max(1, options.maxItems ?? DEFAULT_MAX_ITEMS);
  const minimumItemMinutes = Math.max(1, options.minimumItemMinutes ?? 10);
  const noteCandidates = rankedStates
    .filter(({ priority }) => priority.shouldRecommend && priority.action !== null)
    .map(({ state, priority }) => ({ kind: "note" as const, state, priority }));
  const referenceCandidates = rankedMissingReferences
    .filter(({ priority }) => priority.shouldRecommend && priority.action !== null)
    .map(({ candidate, priority }) => ({ kind: "missing_reference" as const, candidate, priority }));
  const candidates: PlannerCandidate[] = [...noteCandidates, ...referenceCandidates];
  candidates.sort((left, right) => right.priority.score - left.priority.score || candidateTitle(left).localeCompare(candidateTitle(right), "pt-BR"));

  const items: PlannedStudyItem[] = [];
  let estimatedMinutes = 0;
  for (const candidate of candidates) {
    const { priority } = candidate;
    if (!priority.action || items.length >= maxItems) break;
    const suggestedMinutes = DEFAULT_ACTION_MINUTES[priority.action];
    const remainingMinutes = availableMinutes - estimatedMinutes;
    if (remainingMinutes < minimumItemMinutes) break;

    if (candidate.kind === "note") {
      items.push({
        kind: "note",
        noteId: candidate.state.noteId,
        subjectId: candidate.state.subjectId,
        title: candidate.state.title,
        action: priority.action,
        estimatedMinutes: Math.min(suggestedMinutes, remainingMinutes),
        priority: { score: priority.score, level: priority.level },
        evidence: priority.evidence,
        dataAvailability: candidate.state.dataAvailability,
      });
    } else {
      items.push({
        kind: "missing_reference",
        noteId: null,
        subjectId: candidate.candidate.subjectId,
        title: candidate.candidate.title,
        action: priority.action,
        estimatedMinutes: Math.min(suggestedMinutes, remainingMinutes),
        priority: { score: priority.score, level: priority.level },
        evidence: priority.evidence,
        dataAvailability: "limited",
        sourceNoteIds: candidate.candidate.sourceNoteIds,
      });
    }
    estimatedMinutes += Math.min(suggestedMinutes, remainingMinutes);
  }

  const status: StudyPlanStatus = items.length === 0
    ? "no_urgent_priorities"
    : items.every((item) => item.dataAvailability === "limited")
      ? "limited_data"
      : "ready";
  return { status, availableMinutes, estimatedMinutes, items, message: messageFor(status) };
}
