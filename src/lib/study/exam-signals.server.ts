import type { UpcomingExam } from "./exam-signals";

function isoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/** Loads future exams and their explicit subject associations for one user. */
export async function loadUpcomingExamsForUser(db: any, userId: string, now = new Date()): Promise<UpcomingExam[]> {
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + 14);
  const eventsResult = await db
    .from("events")
    .select("id,title,event_date,subject_id")
    .eq("user_id", userId)
    .eq("event_type", "prova")
    .gte("event_date", isoDate(now))
    .lte("event_date", isoDate(end));
  if (eventsResult.error) throw eventsResult.error;

  const events = eventsResult.data ?? [];
  if (events.length === 0) return [];
  const eventIds = events.map((event: { id: string }) => event.id);
  const associationsResult = await db
    .from("event_subjects")
    .select("event_id,subject_id")
    .in("event_id", eventIds);
  if (associationsResult.error) throw associationsResult.error;

  const subjectsByEvent = new Map<string, Set<string>>();
  for (const event of events as Array<any>) {
    const subjects = subjectsByEvent.get(event.id) ?? new Set<string>();
    if (event.subject_id) subjects.add(event.subject_id);
    subjectsByEvent.set(event.id, subjects);
  }
  for (const association of associationsResult.data ?? []) {
    const subjects = subjectsByEvent.get((association as any).event_id) ?? new Set<string>();
    subjects.add((association as any).subject_id);
    subjectsByEvent.set((association as any).event_id, subjects);
  }

  return (events as Array<any>).map((event) => ({
    id: event.id,
    title: event.title,
    eventDate: event.event_date,
    subjectIds: [...(subjectsByEvent.get(event.id) ?? [])],
  }));
}
