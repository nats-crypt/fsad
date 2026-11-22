import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Loader2, Plane, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen hero-bg flex items-center justify-center px-4 pt-20">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 geo-circle opacity-5" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 geo-circle opacity-5" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mb-4 shadow-gold">
            <Plane className="w-7 h-7 text-gold -rotate-45" />
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-widest uppercase text-cloud">
            Horizon Airways
          </h1>
          <p className="font-display text-sm italic text-runway mt-1">
            Sign in to your account
          </p>
        </div>

        {/* Card */}
        <div className="card border border-sky-light/30 p-8">
          <h2 className="font-heading text-2xl font-bold tracking-wide text-cloud mb-6">
            Welcome Back
          </h2>

          {error && (
            <div className="flex items-start gap-3 bg-ember/10 border border-ember/30 rounded-lg px-4 py-3 mb-5">
              <AlertCircle className="w-4 h-4 text-ember flex-shrink-0 mt-0.5" />
              <p className="text-sm text-ember">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email Address
              </label>
              <div className="input-group">
                <Mail className="input-icon w-4 h-4" />
                <input
                  id="email"
                  type="email"
                  className="input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <div className="input-group">
                <Lock className="input-icon w-4 h-4" />
                <input
                  id="password"
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <div className="text-right mt-1">
                <Link to="/forgot-password" className="text-xs text-gold hover:text-gold/80 transition-colors">
                  Forgot password?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full btn-lg mt-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing In…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="divider divider-gold mt-6">
            <span className="text-xs text-runway font-heading tracking-widest uppercase">
              New here?
            </span>
          </div>

          <Link to="/register" className="btn-ghost w-full text-center mt-4">
            Create an Account
          </Link>

          {/* Demo credentials hint */}
          <div className="mt-5 p-3 rounded-lg bg-sky-mid/40 border border-sky-light/20">
            <p className="text-xs text-runway/70 text-center font-mono">
              Demo: demo@horizon.air / Passw0rd!
              <br />
              Admin: admin@horizon.air / Passw0rd!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
