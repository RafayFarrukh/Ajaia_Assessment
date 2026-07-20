import { useEffect, useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import { api } from '../api';
import type { User } from '../types';

interface Props {
  onLogin: (user: User) => void;
}

export default function Login({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoUsers, setDemoUsers] = useState<Pick<User, 'email' | 'name'>[]>([]);

  useEffect(() => {
    api.demoUsers().then(({ users }) => setDemoUsers(users)).catch(() => {});
  }, []);

  async function submit(e: FormEvent | MouseEvent, overrideEmail?: string) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { user } = await api.login(
        overrideEmail || email,
        overrideEmail ? 'password123' : password
      );
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <div className="login-card">
        <h1 className="brand-lockup" style={{ margin: 0 }}>
          <img src="/logo.png" alt="Ajaia" className="login-logo" />
          <span className="brand-suffix">Docs</span>
        </h1>
        <p className="muted">A lightweight collaborative document editor.</p>
        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alice@ajaia.test"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password123"
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        {demoUsers.length > 0 && (
          <div className="demo-users">
            <p className="muted small">Demo accounts (password: password123) — one click:</p>
            {demoUsers.map((u) => (
              <button
                key={u.email}
                className="btn ghost small"
                disabled={busy}
                onClick={(e) => submit(e, u.email)}
              >
                {u.name} · {u.email}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
