// Lightweight in-memory presence: docId → userId → activity timestamps.
// Deliberately not persisted — presence is ephemeral by nature, and the app
// deploys as a single process at this scope (documented in the architecture note).
const ACTIVE_WINDOW_MS = 25_000;
// A user counts as "editing" if they saved content this recently.
const EDITING_WINDOW_MS = 20_000;

interface Activity {
  seen: number;
  editedAt?: number;
}

const presence = new Map<number, Map<number, Activity>>();

export interface ActiveUser {
  userId: number;
  editing: boolean;
}

export function heartbeat(docId: number, userId: number): ActiveUser[] {
  let doc = presence.get(docId);
  if (!doc) {
    doc = new Map();
    presence.set(docId, doc);
  }
  const now = Date.now();
  const me = doc.get(userId) ?? { seen: now };
  me.seen = now;
  doc.set(userId, me);

  const active: ActiveUser[] = [];
  for (const [uid, activity] of doc) {
    if (now - activity.seen <= ACTIVE_WINDOW_MS) {
      active.push({
        userId: uid,
        editing: activity.editedAt !== undefined && now - activity.editedAt <= EDITING_WINDOW_MS,
      });
    } else {
      doc.delete(uid);
    }
  }
  return active;
}

/** Record that a user just saved content — flips their presence to "editing". */
export function markEditing(docId: number, userId: number): void {
  let doc = presence.get(docId);
  if (!doc) {
    doc = new Map();
    presence.set(docId, doc);
  }
  const now = Date.now();
  const me = doc.get(userId) ?? { seen: now };
  me.seen = now;
  me.editedAt = now;
  doc.set(userId, me);
}

export function leave(docId: number, userId: number): void {
  presence.get(docId)?.delete(userId);
}
