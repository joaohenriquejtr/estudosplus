import assert from "node:assert/strict";
import test from "node:test";

import { getExamPrioritySignal } from "./exam-signals";

const now = new Date("2026-08-19T12:00:00.000Z");

test("usa somente provas que incluem a matéria da nota e escolhe a mais próxima", () => {
  const signal = getExamPrioritySignal("bio", [
    { id: "1", title: "Matemática", eventDate: "2026-08-20", subjectIds: ["mat"] },
    { id: "2", title: "Biologia", eventDate: "2026-08-24", subjectIds: ["bio"] },
    { id: "3", title: "Simulado", eventDate: "2026-08-21", subjectIds: ["bio", "qui"] },
  ], now);
  assert.deepEqual(signal, { relatedExamDays: 2, relatedExamCount: 2 });
});

test("ignora provas passadas e matérias sem associação", () => {
  const signal = getExamPrioritySignal("bio", [
    { id: "1", title: "Prova passada", eventDate: "2026-08-18", subjectIds: ["bio"] },
    { id: "2", title: "Matemática", eventDate: "2026-08-20", subjectIds: ["mat"] },
  ], now);
  assert.equal(signal, null);
});
