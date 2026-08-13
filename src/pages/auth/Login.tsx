import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { homeForRole } from '../../lib/authRoutes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Lock, ShieldCheck, Timer, Wallet } from 'lucide-react';

const points = [
  { icon: Timer, text: 'Real-time attendance & shift tracking' },
  { icon: Wallet, text: 'Automated salary slips and pay schedules' },
  { icon: ShieldCheck, text: 'Role-based access for admin, HR & staff' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="login-page">
      <aside className="login-aside">
        <div className="login-brand">
          <span className="login-brand-mark">H</span>
          <span className="login-brand-name">
            <strong>HRMS</strong>
            <small>Workforce Suite</small>
          </span>
        </div>

        <div className="login-aside-copy">
          <h1>Your entire workforce, in one precise workspace.</h1>
          <p>
            Attendance, leaves, overtime, performance and payroll — tracked with clarity and built
            on a calm, high-trust interface.
          </p>
          <ul className="login-points">
            {points.map((p) => (
              <li key={p.text}>
                <p.icon size={18} aria-hidden />
                {p.text}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="login-side">
        <Card className="login-card p-0">
          <CardContent className="p-0">
            <div className="login-card-brand">
              <span className="brand-mark">H</span>
              <h1>Sign in</h1>
            </div>
            <p className="login-sub">Sign in to continue to your workspace</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  const user = await login(email, password);
                  navigate(homeForRole(user.role));
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Login failed');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="grid gap-1.5 mt-6">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5 mt-4">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive mt-3" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full mt-6" size="lg" disabled={busy}>
                <Lock size={16} aria-hidden />
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mt-5">
              <CheckCircle2 size={14} aria-hidden />
              Secured with role-based access control
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
