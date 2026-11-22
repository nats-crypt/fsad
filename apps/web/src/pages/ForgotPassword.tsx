import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader2, Plane, AlertCircle, CheckCircle } from 'lucide-react';
import { api, ApiError } from '../lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState(''); // dev mode: token returned directly

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ message: string; resetToken?: string }>(
        '/auth/forgot-password',
        { email },
      );
      // In dev mode the API returns the raw token so we can test without email
      if (res.resetToken) setToken(res.resetToken);
      else setToken('sent'); // production path: email was sent
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen hero-bg flex items-center justify-center px-4 pt-20">
      <div className="w-full max-w-md relative z-10 animate-fade-up">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mb-4 shadow-gold">
            <Plane className="w-7 h-7 text-gold -rotate-45" />
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-widest uppercase text-cloud">
            Horizon Airways
          </h1>
          <p className="font-display text-sm italic text-runway mt-1">Reset your password</p>
        </div>

        <div className="card border border-sky-light/30 p-8">
          <h2 className="font-heading text-2xl font-bold tracking-wide text-cloud mb-2">
            Forgot Password?
          </h2>
          <p className="text-sm text-runway mb-6">
            Enter your email and we'll send you a link to reset your password.
          </p>

          {token ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-jade/10 border border-jade/30 rounded-lg px-4 py-3">
                <CheckCircle className="w-4 h-4 text-jade flex-shrink-0 mt-0.5" />
                <p className="text-sm text-jade">
                  {token === 'sent'
                    ? 'Check your inbox — a reset link has been sent.'
                    : 'Reset token generated (dev mode — in production this would be emailed).'}
                </p>
              </div>
              {token !== 'sent' && (
                <div className="p-3 rounded-lg bg-sky-mid/40 border border-sky-light/20">
                  <p className="text-xs text-runway mb-1 font-heading tracking-wider uppercase">Dev — Reset Token</p>
                  <p className="text-xs font-mono text-cloud break-all">{token}</p>
                  <Link
                    to={`/reset-password?token=${token}`}
                    className="btn-primary w-full text-center mt-3 inline-flex justify-center"
                  >
                    Continue to Reset Password
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-start gap-3 bg-ember/10 border border-ember/30 rounded-lg px-4 py-3 mb-5">
                  <AlertCircle className="w-4 h-4 text-ember flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-ember">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label" htmlFor="email">Email Address</label>
                  <div className="input-group">
                    <Mail className="input-icon w-4 h-4" />
                    <input id="email" type="email" className="input" placeholder="you@example.com"
                      value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full btn-lg mt-2" disabled={loading}>
                  {loading ? <><Loader2 className="w-5 h-5 animate-spin" />Sending…</> : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}

          <div className="divider divider-gold mt-6">
            <span className="text-xs text-runway font-heading tracking-widest uppercase">Remember it?</span>
          </div>
          <Link to="/login" className="btn-ghost w-full text-center mt-4">Back to Sign In</Link>
        </div>
      </div>
    </div>
  );
}
