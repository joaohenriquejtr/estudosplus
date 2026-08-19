export type LearningTemplateKind = "aula" | "resumo" | "exercicios" | "fichamento" | "anotacao_livre";

export type LearningState = {
  noteId: string;
  subjectId: string;
  title: string;
  category: string;
  templateKind: LearningTemplateKind;
  isStub: boolean;
  createdAt: string;
  updatedAt: string;
  lastViewedAt: string | null;
  lastReviewedAt: string | null;
  daysSinceLastViewed: number | null;
  daysSinceLastReview: number | null;
  flashcards: {
    totalAttempts: number;
    correctAttempts: number;
    incorrectAttempts: number;
    accuracyPercent: number | null;
    recentIncorrectAttempts: number;
    lastAttemptAt: string | null;
  };
  socratic: {
    sessionCount: number;
    lastSessionAt: string | null;
  };
  subjectStudy: {
    completedSessions: number;
    lastCompletedAt: string | null;
  };
  consolidation: {
    hasSummary: boolean;
    hasExercises: boolean;
    needsConsolidation: boolean;
  };
  dataAvailability: "limited" | "available";
};

export type LearningStateSourceNote = {
  id: string;
  subjectId: string;
  title: string | null;
  category: string;
  textContent: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LearningStateSourceProficiency = {
  noteId: string;
  totalAttempts: number | null;
  correctAttempts: number | null;
  lastReviewedAt: string | null;
};

export type LearningStateSourceEvent = {
  type: string;
  noteId: string | null;
  subjectId: string | null;
  occurredAt: string;
};

export type LearningStateSourceSession = {
  subjectId: string | null;
  completed: boolean;
  endedAt: string | null;
};

const DAY_MS = 86_400_000;
const RECENT_ERROR_DAYS = 30;
const REVIEW_EVENT_TYPES = new Set([
  "NOTE_REVIEWED",
  "FLASHCARD_CORRECT",
  "FLASHCARD_INCORRECT",
  "SOCRATIC_SESSION",
  "EXERCISE_COMPLETED",
  "STUDY_SESSION_COMPLETED",
]);

function latestDate(values: Array<string | null | undefined>): string | null {
  const valid = values.filter((value): value is string => Boolean(value) && !Number.isNaN(new Date(value).getTime()));
  if (valid.length === 0) return null;
  return valid.reduce((latest, current) => new Date(current).getTime() > new Date(latest).getTime() ? current : latest);
}

function daysSince(value: string | null, now: Date): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return null;
  return Math.max(0, Math.floor((now.getTime() - timestamp) / DAY_MS));
}

function normalizedTopic(title: string | null): string {
  return (title ?? "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/^(aula|resumo|exercícios|exercicios|fichamento)\s*[:\-–—]?\s*/i, "")
    .replace(/\s+/g, " ");
}

function topicKey(note: LearningStateSourceNote): string {
  const topic = normalizedTopic(note.title);
  return `${note.subjectId}:${topic || `untitled:${note.id}`}`;
}

export function inferLearningTemplate(note: Pick<LearningStateSourceNote, "category" | "textContent">): LearningTemplateKind {
  if (note.category === "resumo") return "resumo";
  if (note.category === "exercicio") return "exercicios";
  if (note.category === "material" && /^#\s*fichamento\b/im.test(note.textContent ?? "")) return "fichamento";

  const content = note.textContent ?? "";
  if (/^##\s*conteúdo\s*$/im.test(content) && /^##\s*pontos importantes\s*$/im.test(content)) return "aula";
  return "anotacao_livre";
}

function isStub(textContent: string | null, title: string | null): boolean {
  const content = textContent?.trim() ?? "";
  return !content || (!!title?.trim() && content === `# ${title.trim()}`);
}

/** Creates a deterministic learning snapshot from persisted facts only. */
export function buildLearningStates(
  notes: LearningStateSourceNote[],
  proficiency: LearningStateSourceProficiency[],
  events: LearningStateSourceEvent[],
  sessions: LearningStateSourceSession[],
  now = new Date(),
): LearningState[] {
  const proficiencyByNote = new Map(proficiency.map((entry) => [entry.noteId, entry]));
  const eventsByNote = new Map<string, LearningStateSourceEvent[]>();
  for (const event of events) {
    if (!event.noteId) continue;
    const list = eventsByNote.get(event.noteId) ?? [];
    list.push(event);
    eventsByNote.set(event.noteId, list);
  }

  const subjectSessions = new Map<string, LearningStateSourceSession[]>();
  for (const session of sessions) {
    if (!session.completed || !session.subjectId || !session.endedAt) continue;
    const list = subjectSessions.get(session.subjectId) ?? [];
    list.push(session);
    subjectSessions.set(session.subjectId, list);
  }

  const topicNotes = new Map<string, LearningStateSourceNote[]>();
  for (const note of notes) {
    const key = topicKey(note);
    const list = topicNotes.get(key) ?? [];
    list.push(note);
    topicNotes.set(key, list);
  }

  const recentCutoff = now.getTime() - RECENT_ERROR_DAYS * DAY_MS;
  return notes.map((note) => {
    const noteEvents = eventsByNote.get(note.id) ?? [];
    const noteProficiency = proficiencyByNote.get(note.id);
    const templateKind = inferLearningTemplate(note);
    const sameTopic = topicNotes.get(topicKey(note)) ?? [];
    const hasSummary = sameTopic.some((candidate) => candidate.id !== note.id && inferLearningTemplate(candidate) === "resumo");
    const hasExercises = sameTopic.some((candidate) => candidate.id !== note.id && inferLearningTemplate(candidate) === "exercicios");
    const lastViewedAt = latestDate(noteEvents.filter((event) => event.type === "NOTE_VIEWED").map((event) => event.occurredAt));
    const lastEventReview = latestDate(noteEvents.filter((event) => REVIEW_EVENT_TYPES.has(event.type)).map((event) => event.occurredAt));
    const lastReviewedAt = latestDate([noteProficiency?.lastReviewedAt, lastEventReview]);
    const totalAttempts = Math.max(0, noteProficiency?.totalAttempts ?? 0);
    const correctAttempts = Math.min(totalAttempts, Math.max(0, noteProficiency?.correctAttempts ?? 0));
    const incorrectAttempts = totalAttempts - correctAttempts;
    const recentIncorrectAttempts = noteEvents.filter((event) => event.type === "FLASHCARD_INCORRECT" && new Date(event.occurredAt).getTime() >= recentCutoff).length;
    const socraticEvents = noteEvents.filter((event) => event.type === "SOCRATIC_SESSION");
    const completedSubjectSessions = subjectSessions.get(note.subjectId) ?? [];
    const hasObservedLearning = noteEvents.length > 0 || totalAttempts > 0 || completedSubjectSessions.length > 0;

    return {
      noteId: note.id,
      subjectId: note.subjectId,
      title: note.title?.trim() || "Sem título",
      category: note.category,
      templateKind,
      isStub: isStub(note.textContent, note.title),
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      lastViewedAt,
      lastReviewedAt,
      daysSinceLastViewed: daysSince(lastViewedAt, now),
      daysSinceLastReview: daysSince(lastReviewedAt, now),
      flashcards: {
        totalAttempts,
        correctAttempts,
        incorrectAttempts,
        accuracyPercent: totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : null,
        recentIncorrectAttempts,
        lastAttemptAt: noteProficiency?.lastReviewedAt ?? null,
      },
      socratic: {
        sessionCount: socraticEvents.length,
        lastSessionAt: latestDate(socraticEvents.map((event) => event.occurredAt)),
      },
      subjectStudy: {
        completedSessions: completedSubjectSessions.length,
        lastCompletedAt: latestDate(completedSubjectSessions.map((session) => session.endedAt)),
      },
      consolidation: {
        hasSummary,
        hasExercises,
        needsConsolidation: templateKind === "aula" && !hasSummary,
      },
      dataAvailability: hasObservedLearning ? "available" : "limited",
    };
  });
}
