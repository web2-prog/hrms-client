import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="login-page">
      <form
        className="login-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            const user = await login(email, password);
            if (user.role === 'admin') navigate('/admin');
            else if (user.role === 'hr') navigate('/hr');
            else navigate('/app');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="login-brand">
          <span className="login-brand-mark">H</span>
          <h1>HRMS</h1>
        </div>
        <p className="login-sub">Sign in to continue to your workspace</p>
        <div style={{ marginTop: '1.5rem' }}>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div style={{ marginTop: '1rem' }}>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p style={{ color: 'var(--error)', marginBottom: 0 }}>{error}</p>}
        <button className="btn" style={{ width: '100%', marginTop: '1.35rem' }} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
