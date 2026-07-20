import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import type { Role, ShareEntry } from '../types';

interface Props {
  docId: string | number;
  docTitle: string;
  onClose: () => void;
}

export default function ShareDialog({ docId, docTitle, onClose }: Props) {
  const [shares, setShares] = useState<ShareEntry[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    api
      .listShares(docId)
      .then(({ shares }) => setShares(shares))
      .catch((err: Error) => setError(err.message));
  }, [docId]);
  useEffect(refresh, [refresh]);

  async function addShare(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.addShare(docId, email, role);
      setEmail('');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Share failed');
    } finally {
      setBusy(false);
    }
  }

  async function removeShare(shareId: number) {
    try {
      await api.removeShare(docId, shareId);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove access');
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Share “{docTitle}”</h2>
        <form onSubmit={addShare} className="share-form">
          <input
            type="email"
            placeholder="teammate@ajaia.test"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            aria-label="Role"
          >
            <option value="editor">Can edit</option>
            <option value="viewer">View only</option>
          </select>
          <button className="btn primary" disabled={busy}>Share</button>
        </form>
        {error && <p className="error">{error}</p>}

        <h3 className="muted small">People with access</h3>
        {shares.length === 0 && <p className="muted small">Only you so far.</p>}
        <ul className="share-list">
          {shares.map((s) => (
            <li key={s.id}>
              <span>
                {s.name} <span className="muted small">({s.email})</span>
              </span>
              <span className="share-right">
                <span className="badge shared">{s.role === 'viewer' ? 'view only' : 'can edit'}</span>
                <button className="btn ghost small" onClick={() => removeShare(s.id)}>
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
