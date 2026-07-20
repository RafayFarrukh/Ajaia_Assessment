import { useEffect, useState } from 'react';
import { api } from '../api';
import type { RevisionSummary } from '../types';
import { timeAgo } from '../timeAgo';

interface Props {
  docId: string | number;
  canRestore: boolean;
  onClose: () => void;
  /** Called with the restored doc so the editor can refresh its content. */
  onRestored: (doc: { title: string; content: string }) => void;
}

export default function HistoryPanel({ docId, canRestore, onClose, onRestored }: Props) {
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    api
      .listRevisions(docId)
      .then(({ revisions }) => setRevisions(revisions))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoaded(true));
  }, [docId]);

  async function restore(revId: number) {
    if (!window.confirm('Restore this version? The current state is saved to history first.')) {
      return;
    }
    setBusyId(revId);
    setError('');
    try {
      const { doc } = await api.restoreRevision(docId, revId);
      onRestored(doc);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <aside className="drawer" aria-label="Version history">
      <div className="drawer-head">
        <h3>Version history</h3>
        <button className="btn ghost small" onClick={onClose}>✕</button>
      </div>
      {error && <p className="error">{error}</p>}
      {loaded && revisions.length === 0 && (
        <p className="muted small">No versions yet — snapshots are captured as you edit.</p>
      )}
      <ul className="drawer-list">
        {revisions.map((r) => (
          <li key={r.id} className="revision-row">
            <div>
              <div className="revision-title">{r.title}</div>
              <div className="muted small">
                {timeAgo(r.createdAt)} · {r.authorName}
              </div>
            </div>
            {canRestore && (
              <button
                className="btn small"
                disabled={busyId !== null}
                onClick={() => restore(r.id)}
              >
                {busyId === r.id ? 'Restoring…' : 'Restore'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
