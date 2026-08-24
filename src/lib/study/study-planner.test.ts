import assert from "node:assert/strict";
import test from "node:test";

import { buildStudyPlan } from "./study-planner";
import type { RankedLearningState } from "./study-planner";
import type { LearningState } from "./learning-state";
import type { PriorityResult } from "./priority-engine";

const state = (id: string, title: string, dataAvailability: LearningState["dataAvailability"] = "available"): LearningState => ({
  noteId: id,
  subjectId: "subject-1",
  title,
  category: "resumo",
  templateKind: "resumo",
  isStub: false,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  lastViewedAt: null,
  lastReviewedAt: null,
  daysSinceLastViewed: null,
  daysSinceLastReview: null,
  flashcards: { totalAttempts: 0, correctAttempts: 0, incorrectAttempts: 0, accuracyPercent: null, recentIncorrectAttempts: 0, lastAttemptAt: null },
  socratic: { sessionCount: 0, lastSessionAt: null },
  subjectStudy: { completedSessions: 0, lastCompletedAt: null },
  consolidation: { hasSummary: false, hasExercises: false, needsConsolidation: false },
  dataAvailability,
});

const priority = (score: number, action: PriorityResult["action"]): PriorityResult => ({
  score,
  level: score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW",
  action,
  shouldRecommend: action !== null && score > 0,
  isMastered: false,
  evidence: [{ code: "review_gap", points: score, description: "Evidência real." }],
});

test("monta uma sessão com várias notas sem exceder o tempo disponível", () => {
  const ranking: RankedLearningState[] = [
    { state: state("1", "Meiose"), priority: priority(82, "RECUPERAR") },
    { state: state("2", "Mitose"), priority: priority(64, "REVISAR") },
    { state: state("3", "Genética"), priority: priority(52, "PRATICAR") },
  ];
  const plan = buildStudyPlan(ranking, { availableMinutes: 50 });
  assert.equal(plan.status, "ready");
  assert.equal(plan.items.length, 3);
  assert.equal(plan.estimatedMinutes, 50);
  assert.deepEqual(plan.items.map((item) => item.title), ["Meiose", "Mitose", "Genética"]);
});

test("não força uma tarefa quando não há prioridade recomendável", () => {
  const plan = buildStudyPlan([{ state: state("1", "Genética"), priority: priority(0, null) }], { availableMinutes: 30 });
  assert.equal(plan.status, "no_urgent_priorities");
  assert.equal(plan.items.length, 0);
});

test("mostra estado honesto quando só há poucos dados", () => {
  const plan = buildStudyPlan([{ state: state("1", "Aula 2", "limited"), priority: priority(40, "CONSOLIDAR") }], { availableMinutes: 20 });
  assert.equal(plan.status, "limited_data");
  assert.equal(plan.items[0]?.estimatedMinutes, 20);
});
