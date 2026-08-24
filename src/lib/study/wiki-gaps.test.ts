import assert from "node:assert/strict";
import test from "node:test";

import { findMissingWikiReferences } from "./wiki-gaps";

test("conta links ausentes por matéria e não confunde títulos iguais em matérias diferentes", () => {
  const gaps = findMissingWikiReferences([
    { id: "1", subjectId: "bio", title: "Mitose", textContent: "Veja [[Centríolo]] e [[Centríolo]]." },
    { id: "2", subjectId: "bio", title: "Meiose", textContent: "Compare com [[Centríolo]]." },
    { id: "3", subjectId: "mat", title: "Centríolo", textContent: "" },
  ]);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0]?.title, "Centríolo");
  assert.equal(gaps[0]?.subjectId, "bio");
  assert.equal(gaps[0]?.referenceCount, 3);
  assert.deepEqual(gaps[0]?.sourceNoteIds, ["1", "2"]);
});

test("não marca como lacuna uma nota existente na própria matéria", () => {
  const gaps = findMissingWikiReferences([
    { id: "1", subjectId: "bio", title: "Mitose", textContent: "Veja [[Centríolo]]." },
    { id: "2", subjectId: "bio", title: "Centríolo", textContent: "Conteúdo" },
  ]);
  assert.equal(gaps.length, 0);
});
