import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader2, Plane, AlertCircle, CheckCircle } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { cn } from '../lib/utils';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  function emailError() {
    if (!email.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address';
    return '';
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEmailTouched(true);
    if (emailError()) return;
    setError('');
    setLoading(true);
    try {
      await api.post<{ message: string }>('/auth/forgot-password', { email });
      setSent(true);
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

          {sent ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-jade/10 border border-jade/30 rounded-lg px-4 py-3">
                <CheckCircle className="w-4 h-4 text-jade flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-jade font-semibold">Check your inbox</p>
                  <p className="text-sm text-jade/80 mt-0.5">
                    A password reset link has been sent to <strong>{email}</strong>. It expires in 15 minutes.
                  </p>
                </div>
              </div>
              <Link to="/login" className="btn-ghost w-full text-center mt-2">Back to Sign In</Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-start gap-3 bg-ember/10 border border-ember/30 rounded-lg px-4 py-3 mb-5">
                  <AlertCircle className="w-4 h-4 text-ember flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-ember">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                  <label className="label" htmlFor="email">Email Address</label>
                  <div className="input-group">
                    <Mail className={cn('input-icon w-4 h-4', emailTouched && emailError() && 'text-ember')} />
                    <input
                      id="email"
                      type="email"
                      className={cn('input', emailTouched && emailError() && 'border-ember/60 focus:border-ember')}
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onBlur={() => setEmailTouched(true)}
                      autoComplete="email"
                    />
                  </div>
                  {emailTouched && emailError() && (
                    <p className="text-xs text-ember mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />{emailError()}
                    </p>
                  )}
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
