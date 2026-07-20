import sanitizeHtml from 'sanitize-html';

// Document content is stored as HTML produced by the TipTap editor (or file
// import). Sanitizing on write means stored content is safe to render anywhere.
// The allowlist mirrors exactly what the editor's extensions can produce:
// marks (incl. <mark> highlight, links), headings, lists (incl. task lists,
// which TipTap serializes as ul/li + label/input[type=checkbox]), quotes,
// code blocks, and text-align styles on paragraphs/headings.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
    'mark', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr', 'a',
    'label', 'input', 'span', 'div',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    ul: ['data-type'],
    li: ['data-type', 'data-checked'],
    input: ['type', 'checked'],
    p: ['style'],
    h1: ['style'],
    h2: ['style'],
    h3: ['style'],
    h4: ['style'],
  },
  allowedStyles: {
    '*': {
      'text-align': [/^(left|center|right|justify)$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
};

export function sanitizeContent(html: string): string {
  return sanitizeHtml(html || '', OPTIONS);
}
