import type {
  DocDetail,
  DocSummary,
  Access,
  Role,
  ShareEntry,
  User,
  RevisionSummary,
  CommentEntry,
  PresenceUser,
} from './types';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Thin fetch wrapper: JSON in/out, cookies included, errors normalized to
// ApiError with the server's message.
async function req<T>(
  path: string,
  options: Omit<RequestInit, 'body'> & { body?: unknown } = {}
): Promise<T> {
  const isForm = options.body instanceof FormData;
  const res = await fetch(path, {
    credentials: 'include',
    ...options,
    headers: isForm ? undefined : { 'Content-Type': 'application/json' },
    body: isForm
      ? (options.body as FormData)
      : options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    req<{ user: User }>('/api/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => req<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  me: () => req<{ user: User }>('/api/auth/me'),
  demoUsers: () => req<{ users: Pick<User, 'email' | 'name'>[] }>('/api/auth/demo-users'),

  listDocuments: () => req<{ owned: DocSummary[]; shared: DocSummary[] }>('/api/documents'),
  createDocument: (title: string) =>
    req<{ doc: DocSummary }>('/api/documents', { method: 'POST', body: { title } }),
  getDocument: (id: string | number) =>
    req<{ doc: DocDetail; access: Access }>(`/api/documents/${id}`),
  updateDocument: (id: string | number, patch: { title?: string; content?: string }) =>
    req<{ doc: Pick<DocSummary, 'id' | 'title' | 'updatedAt'> }>(`/api/documents/${id}`, {
      method: 'PATCH',
      body: patch,
    }),
  deleteDocument: (id: string | number) =>
    req<{ ok: true }>(`/api/documents/${id}`, { method: 'DELETE' }),

  listShares: (id: string | number) =>
    req<{ shares: ShareEntry[] }>(`/api/documents/${id}/shares`),
  addShare: (id: string | number, email: string, role: Role) =>
    req<{ share: Omit<ShareEntry, 'id'> }>(`/api/documents/${id}/shares`, {
      method: 'POST',
      body: { email, role },
    }),
  removeShare: (id: string | number, shareId: number) =>
    req<{ ok: true }>(`/api/documents/${id}/shares/${shareId}`, { method: 'DELETE' }),

  listRevisions: (id: string | number) =>
    req<{ revisions: RevisionSummary[] }>(`/api/documents/${id}/revisions`),
  restoreRevision: (id: string | number, revId: number) =>
    req<{ doc: { id: number; title: string; content: string } }>(
      `/api/documents/${id}/revisions/${revId}/restore`,
      { method: 'POST' }
    ),

  listComments: (id: string | number) =>
    req<{ comments: CommentEntry[] }>(`/api/documents/${id}/comments`),
  addComment: (id: string | number, body: string) =>
    req<{ comment: CommentEntry }>(`/api/documents/${id}/comments`, {
      method: 'POST',
      body: { body },
    }),
  deleteComment: (id: string | number, commentId: number) =>
    req<{ ok: true }>(`/api/documents/${id}/comments/${commentId}`, { method: 'DELETE' }),

  presenceHeartbeat: (id: string | number) =>
    req<{ viewers: PresenceUser[] }>(`/api/documents/${id}/presence`, { method: 'POST' }),
  presenceLeave: (id: string | number) =>
    req<{ ok: true }>(`/api/documents/${id}/presence`, { method: 'DELETE' }),

  importFile: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return req<{ doc: { id: number; title: string } }>('/api/upload/import', {
      method: 'POST',
      body: form,
    });
  },
};
