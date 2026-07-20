import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { DocSummary } from '../types';
import { useAuth } from '../App';
import { timeAgo } from '../timeAgo';

interface DocCardProps {
  doc: DocSummary;
  shared?: boolean;
  onDelete?: (doc: DocSummary) => void;
}

function DocCard({ doc, shared, onDelete }: DocCardProps) {
  return (
    <Link to={`/doc/${doc.id}`} className="doc-card">
      <div className="doc-card-title">{doc.title}</div>
      <div className="doc-card-meta">
        {shared ? (
          <span className="badge shared">
            {doc.role === 'viewer' ? 'view only' : 'can edit'} · from {doc.owner.name}
          </span>
        ) : (
          <span className="badge owned">owner</span>
        )}
        <span className="muted small">{timeAgo(doc.updatedAt)}</span>
      </div>
      {!shared && onDelete && (
        <button
          className="doc-card-delete"
          title="Delete document"
          onClick={(e) => {
            e.preventDefault();
            onDelete(doc);
          }}
        >
          ✕
        </button>
      )}
    </Link>
  );
}

export default function Home() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [docs, setDocs] = useState<{ owned: DocSummary[]; shared: DocSummary[] }>({
    owned: [],
    shared: [],
  });
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    api
      .listDocuments()
      .then(setDocs)
      .catch((err: Error) => setError(err.message));
  }, []);
  useEffect(refresh, [refresh]);

  async function createDoc() {
    try {
      const { doc } = await api.createDocument('Untitled document');
      navigate(`/doc/${doc.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create document');
    }
  }

  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setError('');
    try {
      const { doc } = await api.importFile(file);
      navigate(`/doc/${doc.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  async function deleteDoc(doc: DocSummary) {
    if (!window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    try {
      await api.deleteDocument(doc.id);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function logout() {
    await api.logout();
    setUser(null);
  }

  return (
    <div className="page">
      <header className="topbar">
        <span className="brand-lockup">
          <img src="/logo.png" alt="Ajaia" className="topbar-logo" />
          <span className="brand-suffix">Docs</span>
        </span>
        <div className="topbar-right">
          <span className="muted">{user.name}</span>
          <button className="btn ghost" onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className="home">
        <div className="home-actions">
          <button className="btn primary" onClick={createDoc}>+ New document</button>
          <button
            className="btn"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
          >
            {importing ? 'Importing…' : 'Import file (.txt, .md, .docx)'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.docx"
            hidden
            onChange={importFile}
          />
        </div>
        {error && <p className="error">{error}</p>}

        <section>
          <h2>My documents</h2>
          {docs.owned.length === 0 && (
            <p className="muted">No documents yet — create one or import a file.</p>
          )}
          <div className="doc-grid">
            {docs.owned.map((d) => (
              <DocCard key={d.id} doc={d} onDelete={deleteDoc} />
            ))}
          </div>
        </section>

        <section>
          <h2>Shared with me</h2>
          {docs.shared.length === 0 && (
            <p className="muted">Nothing shared with you yet.</p>
          )}
          <div className="doc-grid">
            {docs.shared.map((d) => (
              <DocCard key={d.id} doc={d} shared />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
