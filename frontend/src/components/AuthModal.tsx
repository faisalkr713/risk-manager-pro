import React, { useState } from 'react';
import { API_BASE } from '../constants';

interface AuthUser { id: number; email: string; name: string; is_guest?: boolean; created_at: string; }

interface Props {
  initialMode?: 'login' | 'signup';
  onAuth: (token: string, user: AuthUser) => void;
  onClose: () => void;
  // When the user closes without signing up — keep using guest mode
  onContinueGuest: () => void;
}

const AuthModal: React.FC<Props> = ({ initialMode = 'signup', onAuth, onClose, onContinueGuest }) => {
  const [mode, setMode]         = useState<'login' | 'signup'>(initialMode);
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'signup') {
      if (!name.trim())          return setError('Name is required');
      if (password !== confirm)  return setError('Passwords do not match');
      if (password.length < 6)   return setError('Password must be at least 6 characters');
    }
    if (!email.trim())           return setError('Email is required');
    if (!password)               return setError('Password is required');

    setLoading(true);
    try {
      const token = localStorage.getItem('rmp_token');
      // Signup converts the active guest into a real account (keeps their data).
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/convert';
      const body = mode === 'login' ? { email, password } : { email, password, name };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        if (res.status === 409) setMode('login'); // email exists → suggest login
        return;
      }
      onAuth(data.token, data.user);
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="auth-card auth-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} title="Close">✕</button>

        <div className="auth-logo">
          <div className="auth-logo-icon">⬡</div>
          <div className="auth-logo-text">Trade Calculate</div>
        </div>
        <p className="auth-tagline">
          {mode === 'signup'
            ? 'Save your trades & sync across devices — free.'
            : 'Welcome back — sign in to your account.'}
        </p>

        <div className="auth-tabs">
          <button className={`auth-tab${mode === 'signup' ? ' active' : ''}`} onClick={() => { setMode('signup'); setError(''); }}>Create Account</button>
          <button className={`auth-tab${mode === 'login'  ? ' active' : ''}`} onClick={() => { setMode('login');  setError(''); }}>Sign In</button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === 'signup' && (
            <div className="auth-field">
              <label className="auth-label">Full Name</label>
              <input className="auth-input" type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} autoFocus />
            </div>
          )}
          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input className="auth-input" type="email" placeholder="trader@example.com" value={email} onChange={e => setEmail(e.target.value)} autoFocus={mode === 'login'} />
          </div>
          <div className="auth-field">
            <label className="auth-label">Password</label>
            <input className="auth-input" type="password" placeholder={mode === 'signup' ? 'Min. 6 characters' : 'Your password'} value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          {mode === 'signup' && (
            <div className="auth-field">
              <label className="auth-label">Confirm Password</label>
              <input className="auth-input" type="password" placeholder="Repeat password" value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>
          )}
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'signup' ? 'Create Free Account' : 'Sign In'}
          </button>
        </form>

        <button className="auth-guest-link" onClick={onContinueGuest}>
          Continue as guest →
        </button>
      </div>
    </div>
  );
};

export default AuthModal;
