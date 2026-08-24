import assert from "node:assert/strict";
import test from "node:test";

import { scoreLearningState, scoreMissingReference } from "./priority-engine";
import type { LearningState } from "./learning-state";

const baseState = (overrides: Partial<LearningState> = {}): LearningState => ({
  noteId: "note-1",
  subjectId: "subject-1",
  title: "Meiose",
  category: "resumo",
  templateKind: "resumo",
  isStub: false,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  lastViewedAt: null,
  lastReviewedAt: "2026-08-01T00:00:00.000Z",
  daysSinceLastViewed: null,
  daysSinceLastReview: 18,
  flashcards: { totalAttempts: 20, correctAttempts: 10, incorrectAttempts: 10, accuracyPercent: 50, recentIncorrectAttempts: 4, lastAttemptAt: "2026-08-01T00:00:00.000Z" },
  socratic: { sessionCount: 0, lastSessionAt: null },
  subjectStudy: { completedSessions: 0, lastCompletedAt: null },
  consolidation: { hasSummary: true, hasExercises: false, needsConsolidation: false },
  dataAvailability: "available",
  ...overrides,
});

test("prioriza recuperação quando há baixo desempenho, erros, dúvidas e prova próxima", () => {
  const result = scoreLearningState(baseState(), { detectedDoubts: 2, relatedExamDays: 1 }, undefined, new Date("2026-08-19T00:00:00.000Z"));
  assert.equal(result.action, "RECUPERAR");
  assert.equal(result.level, "HIGH");
  assert.ok(result.evidence.some((item) => item.code === "low_flashcard_accuracy"));
  assert.ok(result.evidence.some((item) => item.code === "recent_flashcard_errors"));
});

test("não recomenda nota dominada sem prova próxima", () => {
  const result = scoreLearningState(baseState({
    daysSinceLastReview: 2,
    flashcards: { totalAttempts: 12, correctAttempts: 11, incorrectAttempts: 1, accuracyPercent: 92, recentIncorrectAttempts: 0, lastAttemptAt: "2026-08-17T00:00:00.000Z" },
  }), {}, undefined, new Date("2026-08-19T00:00:00.000Z"));
  assert.equal(result.isMastered, true);
  assert.equal(result.shouldRecommend, false);
  assert.equal(result.score, 0);
});

test("prioriza consolidação para aula sem resumo", () => {
  const result = scoreLearningState(baseState({
    templateKind: "aula",
    flashcards: { totalAttempts: 0, correctAttempts: 0, incorrectAttempts: 0, accuracyPercent: null, recentIncorrectAttempts: 0, lastAttemptAt: null },
    consolidation: { hasSummary: false, hasExercises: false, needsConsolidation: true },
    daysSinceLastReview: null,
  }), {}, undefined, new Date("2026-08-19T00:00:00.000Z"));
  assert.equal(result.action, "CONSOLIDAR");
  assert.ok(result.evidence.some((item) => item.code === "missing_consolidation"));
});

test("recomenda construir um stub vazio", () => {
  const result = scoreLearningState(baseState({
    isStub: true,
    flashcards: { totalAttempts: 0, correctAttempts: 0, incorrectAttempts: 0, accuracyPercent: null, recentIncorrectAttempts: 0, lastAttemptAt: null },
    daysSinceLastReview: null,
  }), {}, undefined, new Date("2026-08-19T00:00:00.000Z"));
  assert.equal(result.action, "CONSTRUIR");
  assert.ok(result.evidence.some((item) => item.code === "empty_stub"));
});

test("prioriza referência ausente quando ela é recorrente e relacionada a prova", () => {
  const result = scoreMissingReference({ title: "Somatório", referenceCount: 5, relatedExamDays: 4, relatedExamRelevance: 1, inActiveStudyCycle: true });
  assert.equal(result.action, "CONSTRUIR");
  assert.ok(result.score >= 30);
  assert.ok(result.evidence.some((item) => item.code === "missing_reference"));
});
