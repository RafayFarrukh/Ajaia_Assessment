export interface User {
  id: number;
  email: string;
  name: string;
}

export type Role = 'viewer' | 'editor';
export type Access = 'owner' | Role;

export interface DocSummary {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  owner: User;
  /** Present only on shared-with-me documents. */
  role?: Role;
}

export interface DocDetail extends DocSummary {
  content: string;
}

export interface ShareEntry {
  id: number;
  role: Role;
  email: string;
  name: string;
}

export interface RevisionSummary {
  id: number;
  title: string;
  createdAt: string;
  authorName: string;
}

export interface CommentEntry {
  id: number;
  body: string;
  createdAt: string;
  author: { id: number; name: string };
}

export interface PresenceUser extends User {
  /** True while this person is actively saving changes (last ~20 s). */
  editing: boolean;
}
