import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import type { CommentEntry } from '../types';
import { useAuth } from '../App';
import { timeAgo } from '../timeAgo';

interface Props {
  docId: string | number;
  isOwner: boolean;
  onClose: () => void;
}

export default function CommentsPanel({ docId, isOwner, onClose }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentEntry[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    api
      .listComments(docId)
      .then(({ comments }) => setComments(comments))
      .catch((err: Error) => setError(err.message));
  }, [docId]);
  useEffect(refresh, [refresh]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api.addComment(docId, body.trim());
      setBody('');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add comment');
    } finally {
      setBusy(false);
    }
  }

  async function remove(commentId: number) {
    try {
      await api.deleteComment(docId, commentId);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete comment');
    }
  }

  return (
    <aside className="drawer" aria-label="Comments">
      <div className="drawer-head">
        <h3>Comments</h3>
        <button className="btn ghost small" onClick={onClose}>✕</button>
      </div>
      {error && <p className="error">{error}</p>}
      {comments.length === 0 && (
        <p className="muted small">No comments yet — start the discussion.</p>
      )}
      <ul className="drawer-list">
        {comments.map((c) => (
          <li key={c.id} className="comment-row">
            <div className="comment-head">
              <strong>{c.author.name}</strong>
              <span className="muted small">{timeAgo(c.createdAt)}</span>
              {(c.author.id === user.id || isOwner) && (
                <button
                  className="btn ghost small comment-delete"
                  title="Delete comment"
                  onClick={() => remove(c.id)}
                >
                  ✕
                </button>
              )}
            </div>
            <div className="comment-body">{c.body}</div>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="comment-form">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment…"
          rows={3}
          maxLength={2000}
        />
        <button className="btn primary" disabled={busy || !body.trim()}>
          {busy ? 'Posting…' : 'Comment'}
        </button>
      </form>
    </aside>
  );
}
