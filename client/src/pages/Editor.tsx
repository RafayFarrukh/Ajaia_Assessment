import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import LinkExtension from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TurndownService from 'turndown';
import { api } from '../api';
import type { Access, DocDetail, PresenceUser } from '../types';
import { useAuth } from '../App';
import Toolbar from '../components/Toolbar';
import ShareDialog from '../components/ShareDialog';
import HistoryPanel from '../components/HistoryPanel';
import CommentsPanel from '../components/CommentsPanel';

const SAVE_DEBOUNCE_MS = 800;
const PRESENCE_INTERVAL_MS = 10_000;

type SaveState = 'saved' | 'saving' | 'error';
type Panel = 'history' | 'comments' | null;

function downloadFile(filename: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [access, setAccess] = useState<Access>('owner');
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [shareOpen, setShareOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [viewers, setViewers] = useState<PresenceUser[]>([]);
  const [counts, setCounts] = useState({ words: 0, chars: 0 });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const readOnly = access === 'viewer';

  const updateCounts = useCallback((text: string) => {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    setCounts({ words, chars: text.length });
  }, []);

  const scheduleSave = useCallback(
    (patch: { title?: string; content?: string }) => {
      clearTimeout(saveTimer.current);
      setSaveState('saving');
      saveTimer.current = setTimeout(async () => {
        try {
          await api.updateDocument(id!, patch);
          setSaveState('saved');
        } catch (err) {
          setSaveState('error');
          setError(err instanceof Error ? err.message : 'Save failed');
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [id]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Highlight,
      LinkExtension.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    onUpdate: ({ editor }) => {
      updateCounts(editor.getText());
      // Guard against non-typing updates (e.g. setEditable) and viewer role.
      if (editor.isEditable) scheduleSave({ content: editor.getHTML() });
    },
  });

  // Load the document once the editor instance exists.
  useEffect(() => {
    if (!editor) return;
    api
      .getDocument(id!)
      .then(({ doc, access }) => {
        setDoc(doc);
        setAccess(access);
        editor.commands.setContent(doc.content, false);
        // Second arg suppresses the update event setEditable fires by default,
        // which would otherwise trigger a phantom autosave on open.
        editor.setEditable(access !== 'viewer', false);
        updateCounts(editor.getText());
      })
      .catch((err: Error) => setError(err.message));
  }, [editor, id]);

  // Presence: heartbeat while the doc is open, leave on unmount.
  useEffect(() => {
    let cancelled = false;
    const beat = () =>
      api
        .presenceHeartbeat(id!)
        .then(({ viewers }) => {
          if (!cancelled) setViewers(viewers);
        })
        .catch(() => {});
    beat();
    const interval = setInterval(beat, PRESENCE_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
      api.presenceLeave(id!).catch(() => {});
    };
  }, [id]);

  // Clear any pending save timer on unmount.
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  function renameDoc(title: string) {
    setDoc((d) => (d ? { ...d, title } : d));
    if (title.trim()) scheduleSave({ title });
  }

  function exportMarkdown() {
    if (!editor || !doc) return;
    const markdown = new TurndownService({ headingStyle: 'atx' }).turndown(editor.getHTML());
    downloadFile(`${doc.title || 'document'}.md`, markdown, 'text/markdown');
    setExportOpen(false);
  }

  function exportPdf() {
    // Print stylesheet hides all chrome, leaving just the document content —
    // the browser's print dialog offers "Save as PDF".
    setExportOpen(false);
    window.print();
  }

  const otherViewers = viewers.filter((v) => v.id !== user.id);

  if (error && !doc) {
    return (
      <div className="center-screen">
        <div>
          <p className="error">{error}</p>
          <Link to="/">← Back to documents</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="topbar no-print">
        <Link to="/" className="btn ghost" title="Back to documents">←</Link>
        <input
          className="title-input"
          value={doc?.title ?? ''}
          disabled={readOnly}
          onChange={(e) => renameDoc(e.target.value)}
          placeholder="Untitled document"
          aria-label="Document title"
        />
        <div className="topbar-right">
          {otherViewers.length > 0 && (
            <div
              className="presence"
              title={otherViewers
                .map((v) => `${v.name} (${v.editing ? 'editing' : 'viewing'})`)
                .join(', ')}
            >
              {otherViewers.map((v) => (
                <span key={v.id} className={`presence-chip${v.editing ? ' editing' : ''}`}>
                  {v.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                </span>
              ))}
              <span className="muted small">
                {otherViewers.some((v) => v.editing) ? 'editing now' : 'viewing now'}
              </span>
            </div>
          )}
          <span className={`save-state ${saveState}`}>
            {readOnly
              ? 'View only'
              : saveState === 'saving'
                ? 'Saving…'
                : saveState === 'error'
                  ? 'Save failed'
                  : 'Saved'}
          </span>
          <div className="export-wrap">
            <button className="btn" onClick={() => setExportOpen((o) => !o)}>
              Export ▾
            </button>
            {exportOpen && (
              <div className="export-menu">
                <button className="btn ghost" onClick={exportMarkdown}>Markdown (.md)</button>
                <button className="btn ghost" onClick={exportPdf}>PDF (print)</button>
              </div>
            )}
          </div>
          <button
            className={`btn${panel === 'history' ? ' active-btn' : ''}`}
            onClick={() => setPanel(panel === 'history' ? null : 'history')}
          >
            History
          </button>
          <button
            className={`btn${panel === 'comments' ? ' active-btn' : ''}`}
            onClick={() => setPanel(panel === 'comments' ? null : 'comments')}
          >
            Comments
          </button>
          {access === 'owner' && (
            <button className="btn primary" onClick={() => setShareOpen(true)}>
              Share
            </button>
          )}
        </div>
      </header>

      {!readOnly && <Toolbar editor={editor} />}
      {error && doc && <p className="error no-print">{error}</p>}

      <div className="editor-layout">
        <main className="editor-wrap">
          <EditorContent editor={editor} className="editor" />
          <div className="doc-stats no-print">
            {counts.words} {counts.words === 1 ? 'word' : 'words'} · {counts.chars} characters
          </div>
        </main>
        {panel === 'history' && (
          <HistoryPanel
            docId={id!}
            canRestore={!readOnly}
            onClose={() => setPanel(null)}
            onRestored={({ title, content }) => {
              setDoc((d) => (d ? { ...d, title, content } : d));
              editor?.commands.setContent(content, false);
            }}
          />
        )}
        {panel === 'comments' && (
          <CommentsPanel docId={id!} isOwner={access === 'owner'} onClose={() => setPanel(null)} />
        )}
      </div>

      {shareOpen && (
        <ShareDialog
          docId={id!}
          docTitle={doc?.title ?? ''}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
