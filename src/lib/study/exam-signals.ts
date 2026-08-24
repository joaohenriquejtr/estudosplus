export type UpcomingExam = {
  id: string;
  title: string;
  eventDate: string;
  subjectIds: string[];
};

export type ExamPrioritySignal = {
  relatedExamDays: number;
  relatedExamCount: number;
};

const DAY_MS = 86_400_000;

function utcDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function dateOnlyDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isNaN(timestamp) ? null : timestamp;
}

/** Returns facts about upcoming exams that explicitly include this subject. */
export function getExamPrioritySignal(subjectId: string, exams: UpcomingExam[], now = new Date()): ExamPrioritySignal | null {
  const today = utcDay(now);
  const days = exams.flatMap((exam) => {
    if (!exam.subjectIds.includes(subjectId)) return [];
    const examDay = dateOnlyDay(exam.eventDate);
    if (examDay == null) return [];
    const daysUntil = Math.round((examDay - today) / DAY_MS);
    return daysUntil >= 0 ? [daysUntil] : [];
  });
  if (days.length === 0) return null;
  return { relatedExamDays: Math.min(...days), relatedExamCount: days.length };
}
