import type { Editor } from '@tiptap/react';
import type { ReactNode } from 'react';

interface BtnProps {
  onClick: () => void;
  active?: boolean;
  title: string;
  disabled?: boolean;
  children: ReactNode;
}

function Btn({ onClick, active, title, children, disabled }: BtnProps) {
  return (
    <button
      type="button"
      className={`tool-btn${active ? ' active' : ''}`}
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep editor selection
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="tool-sep" />;

const HEADING_LEVELS = [1, 2, 3] as const;
const ALIGNMENTS = [
  { value: 'left', label: '⇤', title: 'Align left' },
  { value: 'center', label: '☰', title: 'Align center' },
  { value: 'right', label: '⇥', title: 'Align right' },
] as const;

export default function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  const chain = () => editor.chain().focus();

  function setLink() {
    if (!editor) return;
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL (leave empty to remove):', previous ?? 'https://');
    if (url === null) return; // cancelled
    if (!url.trim() || url.trim() === 'https://') {
      chain().extendMarkRange('link').unsetLink().run();
      return;
    }
    chain().extendMarkRange('link').setLink({ href: url.trim() }).run();
  }

  return (
    <div className="toolbar no-print" role="toolbar" aria-label="Formatting">
      <Btn title="Bold (⌘B)" active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()}>
        <strong>B</strong>
      </Btn>
      <Btn title="Italic (⌘I)" active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()}>
        <em>I</em>
      </Btn>
      <Btn title="Underline (⌘U)" active={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()}>
        <u>U</u>
      </Btn>
      <Btn title="Strikethrough" active={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()}>
        <s>S</s>
      </Btn>
      <Btn title="Highlight" active={editor.isActive('highlight')} onClick={() => chain().toggleHighlight().run()}>
        <mark className="tool-mark">H</mark>
      </Btn>
      <Btn title="Inline code" active={editor.isActive('code')} onClick={() => chain().toggleCode().run()}>
        {'</>'}
      </Btn>
      <Btn title="Link (select text first)" active={editor.isActive('link')} onClick={setLink}>
        🔗
      </Btn>
      <Sep />
      {HEADING_LEVELS.map((level) => (
        <Btn
          key={level}
          title={`Heading ${level}`}
          active={editor.isActive('heading', { level })}
          onClick={() => chain().toggleHeading({ level }).run()}
        >
          H{level}
        </Btn>
      ))}
      <Btn title="Paragraph" active={editor.isActive('paragraph')} onClick={() => chain().setParagraph().run()}>
        ¶
      </Btn>
      <Sep />
      {ALIGNMENTS.map((a) => (
        <Btn
          key={a.value}
          title={a.title}
          active={editor.isActive({ textAlign: a.value })}
          onClick={() => chain().setTextAlign(a.value).run()}
        >
          {a.label}
        </Btn>
      ))}
      <Sep />
      <Btn title="Bulleted list" active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()}>
        • List
      </Btn>
      <Btn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()}>
        1. List
      </Btn>
      <Btn title="Task list" active={editor.isActive('taskList')} onClick={() => chain().toggleTaskList().run()}>
        ☑ Tasks
      </Btn>
      <Sep />
      <Btn title="Blockquote" active={editor.isActive('blockquote')} onClick={() => chain().toggleBlockquote().run()}>
        ❝
      </Btn>
      <Btn title="Code block" active={editor.isActive('codeBlock')} onClick={() => chain().toggleCodeBlock().run()}>
        {'{ }'}
      </Btn>
      <Btn title="Horizontal rule" onClick={() => chain().setHorizontalRule().run()}>
        —
      </Btn>
      <Sep />
      <Btn title="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}>
        Tx
      </Btn>
      <Btn title="Undo (⌘Z)" disabled={!editor.can().undo()} onClick={() => chain().undo().run()}>
        ↺
      </Btn>
      <Btn title="Redo (⇧⌘Z)" disabled={!editor.can().redo()} onClick={() => chain().redo().run()}>
        ↻
      </Btn>
    </div>
  );
}
