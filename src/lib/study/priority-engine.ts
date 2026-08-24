import type { LearningState } from "./learning-state";

export type StudyAction = "CONSTRUIR" | "CONSOLIDAR" | "PRATICAR" | "REVISAR" | "RECUPERAR" | "EXPLORAR";
export type PriorityLevel = "LOW" | "MEDIUM" | "HIGH";

export type PriorityEvidence = {
  code: string;
  points: number;
  description: string;
};

export type PrioritySignals = {
  /** Only set when a later semantic layer has stored explicit doubts. */
  detectedDoubts?: number;
  /** Only set when an exercise tracker has real error data. */
  exerciseIncorrectAttempts?: number;
  /** Direct dependencies or referenced concepts that have no note yet. */
  missingDependencies?: number;
  /** Days to the closest exam genuinely related to this content. */
  relatedExamDays?: number | null;
  /** 0–1 confidence that the exam covers the content. */
  relatedExamRelevance?: number;
};

export type PriorityWeights = {
  reviewGap: number;
  lowFlashcardAccuracy: number;
  recentFlashcardErrors: number;
  socraticDoubts: number;
  exerciseErrors: number;
  examProximity: number;
  missingDependencies: number;
  missingConsolidation: number;
  lowStudyFrequency: number;
  missingReferenceBase: number;
  missingReferencePerLink: number;
};

/** All scoring weights live here; UI components must not reimplement them. */
export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  reviewGap: 18,
  lowFlashcardAccuracy: 20,
  recentFlashcardErrors: 10,
  socraticDoubts: 12,
  exerciseErrors: 16,
  examProximity: 26,
  missingDependencies: 10,
  missingConsolidation: 12,
  lowStudyFrequency: 8,
  missingReferenceBase: 6,
  missingReferencePerLink: 2,
};

export type PriorityResult = {
  score: number;
  level: PriorityLevel;
  action: StudyAction | null;
  shouldRecommend: boolean;
  isMastered: boolean;
  evidence: PriorityEvidence[];
};

export type MissingReferenceCandidate = {
  title: string;
  referenceCount: number;
  relatedExamDays?: number | null;
  relatedExamRelevance?: number;
  inActiveStudyCycle?: boolean;
};

const DAY_MS = 86_400_000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function priorityLevel(score: number): PriorityLevel {
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

function examPoints(days: number | null | undefined, relevance: number | undefined, weight: number): number {
  if (days == null || days < 0) return 0;
  const proximity = days <= 1 ? 1 : days <= 3 ? 0.88 : days <= 7 ? 0.68 : days <= 14 ? 0.35 : 0;
  return Math.round(weight * proximity * clamp(relevance ?? 1, 0, 1));
}

function reviewGapPoints(days: number | null, createdAt: string, weight: number, now: Date): number {
  if (days != null) {
    if (days >= 21) return weight;
    if (days >= 14) return Math.round(weight * 0.78);
    if (days >= 7) return Math.round(weight * 0.55);
    if (days >= 3) return Math.round(weight * 0.22);
    return 0;
  }

  const createdDaysAgo = Math.max(0, Math.floor((now.getTime() - new Date(createdAt).getTime()) / DAY_MS));
  return createdDaysAgo >= 14 ? Math.round(weight * 0.55) : 0;
}

function chooseAction(state: LearningState, signals: PrioritySignals, evidence: PriorityEvidence[]): StudyAction | null {
  if (state.consolidation.needsConsolidation) return "CONSOLIDAR";
  if ((state.flashcards.accuracyPercent ?? 100) < 70 || (signals.exerciseIncorrectAttempts ?? 0) > 0 || (signals.detectedDoubts ?? 0) > 0) return "RECUPERAR";
  if (state.flashcards.totalAttempts === 0 && evidence.some((item) => item.code === "exam_proximity")) return "PRATICAR";
  if (evidence.length > 0) return "REVISAR";
  return null;
}

/**
 * Scores one existing note using only persisted facts and explicit signals.
 * No provider call, random value, or free-text inference participates here.
 */
export function scoreLearningState(
  state: LearningState,
  signals: PrioritySignals = {},
  weights: PriorityWeights = DEFAULT_PRIORITY_WEIGHTS,
  now = new Date(),
): PriorityResult {
  const evidence: PriorityEvidence[] = [];
  const add = (code: string, points: number, description: string) => {
    if (points > 0) evidence.push({ code, points, description });
  };

  const reviewPoints = reviewGapPoints(state.daysSinceLastReview, state.createdAt, weights.reviewGap, now);
  if (reviewPoints > 0) {
    add(
      "review_gap",
      reviewPoints,
      state.daysSinceLastReview == null
        ? "Esta nota ainda não possui uma revisão registrada."
        : `${state.daysSinceLastReview} dia(s) sem revisão registrada.`,
    );
  }

  const accuracy = state.flashcards.accuracyPercent;
  const accuracyFactor = accuracy == null ? 0 : accuracy < 40 ? 1 : accuracy < 60 ? 0.72 : accuracy < 75 ? 0.38 : 0;
  const accuracyPoints = Math.round(weights.lowFlashcardAccuracy * accuracyFactor);
  if (accuracyPoints > 0 && accuracy != null) add("low_flashcard_accuracy", accuracyPoints, `${accuracy}% de acerto nos flashcards.`);

  const recentErrors = state.flashcards.recentIncorrectAttempts;
  const errorPoints = Math.min(weights.recentFlashcardErrors, recentErrors * 2);
  if (errorPoints > 0) add("recent_flashcard_errors", errorPoints, `${recentErrors} erro(s) recente(s) em flashcards.`);

  const doubtCount = Math.max(0, signals.detectedDoubts ?? 0);
  const doubtPoints = Math.min(weights.socraticDoubts, doubtCount * 4);
  if (doubtPoints > 0) add("socratic_doubts", doubtPoints, `${doubtCount} dúvida(s) de aprendizagem detectada(s).`);

  const exerciseErrors = Math.max(0, signals.exerciseIncorrectAttempts ?? 0);
  const exercisePoints = Math.min(weights.exerciseErrors, exerciseErrors * 3);
  if (exercisePoints > 0) add("exercise_errors", exercisePoints, `${exerciseErrors} erro(s) registrado(s) em exercícios.`);

  const relatedExamDays = signals.relatedExamDays;
  const examScore = examPoints(relatedExamDays, signals.relatedExamRelevance, weights.examProximity);
  if (examScore > 0 && relatedExamDays != null) add("exam_proximity", examScore, `Prova relacionada em ${relatedExamDays} dia(s).`);

  const dependencyCount = Math.max(0, signals.missingDependencies ?? 0);
  const dependencyPoints = Math.min(weights.missingDependencies, dependencyCount * 3);
  if (dependencyPoints > 0) add("missing_dependencies", dependencyPoints, `${dependencyCount} dependência(s) ainda não desenvolvida(s).`);

  if (state.consolidation.needsConsolidation) add("missing_consolidation", weights.missingConsolidation, "A aula possui conteúdo, mas ainda não há um resumo relacionado.");

  const subjectStudyDays = state.subjectStudy.lastCompletedAt == null
    ? null
    : Math.max(0, Math.floor((now.getTime() - new Date(state.subjectStudy.lastCompletedAt).getTime()) / DAY_MS));
  const frequencyPoints = subjectStudyDays != null && subjectStudyDays >= 14
    ? weights.lowStudyFrequency
    : subjectStudyDays != null && subjectStudyDays >= 7
      ? Math.round(weights.lowStudyFrequency / 2)
      : 0;
  if (frequencyPoints > 0 && subjectStudyDays != null) add("low_study_frequency", frequencyPoints, `${subjectStudyDays} dia(s) desde a última sessão concluída nesta matéria.`);

  const isMastered = (accuracy ?? 0) >= 85
    && state.flashcards.totalAttempts >= 5
    && (state.daysSinceLastReview ?? Number.POSITIVE_INFINITY) <= 7
    && examScore === 0
    && dependencyCount === 0
    && !state.consolidation.needsConsolidation;
  const score = isMastered ? 0 : clamp(evidence.reduce((sum, item) => sum + item.points, 0), 0, 100);
  const action = isMastered ? null : chooseAction(state, signals, evidence);

  return {
    score,
    level: priorityLevel(score),
    action,
    shouldRecommend: !isMastered && score > 0 && action !== null,
    isMastered,
    evidence,
  };
}

/** Scores a broken wikilink without pretending that it is an existing note. */
export function scoreMissingReference(
  candidate: MissingReferenceCandidate,
  weights: PriorityWeights = DEFAULT_PRIORITY_WEIGHTS,
): PriorityResult {
  const evidence: PriorityEvidence[] = [];
  const referenceCount = Math.max(0, candidate.referenceCount);
  const linkPoints = referenceCount > 0
    ? Math.min(weights.missingDependencies, weights.missingReferenceBase + referenceCount * weights.missingReferencePerLink)
    : 0;
  if (linkPoints > 0) evidence.push({ code: "missing_reference", points: linkPoints, description: `Conceito referenciado por ${referenceCount} nota(s), mas sem nota própria.` });

  if (candidate.inActiveStudyCycle) evidence.push({ code: "active_study_cycle", points: 6, description: "O conceito aparece no ciclo de estudo atual." });
  const examScore = examPoints(candidate.relatedExamDays, candidate.relatedExamRelevance, weights.examProximity);
  if (examScore > 0 && candidate.relatedExamDays != null) evidence.push({ code: "exam_proximity", points: examScore, description: `Prova relacionada em ${candidate.relatedExamDays} dia(s).` });

  const score = clamp(evidence.reduce((sum, item) => sum + item.points, 0), 0, 100);
  return {
    score,
    level: priorityLevel(score),
    action: score > 0 ? "CONSTRUIR" : null,
    shouldRecommend: score > 0,
    isMastered: false,
    evidence,
  };
}
