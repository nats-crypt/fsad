import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Loader2, Plane, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { api, ApiError } from '../lib/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenFromUrl = searchParams.get('token') ?? '';

  const [token, setToken] = useState(tokenFromUrl);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (newPw.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: newPw });
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reset failed. The link may have expired.');
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
          <p className="font-display text-sm italic text-runway mt-1">Set a new password</p>
        </div>

        <div className="card border border-sky-light/30 p-8">
          <h2 className="font-heading text-2xl font-bold tracking-wide text-cloud mb-6">
            Reset Password
          </h2>

          {done ? (
            <div className="flex items-start gap-3 bg-jade/10 border border-jade/30 rounded-lg px-4 py-4">
              <CheckCircle className="w-5 h-5 text-jade flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-jade font-semibold">Password reset successfully!</p>
                <p className="text-xs text-runway mt-1">Redirecting you to sign in…</p>
              </div>
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
                {!tokenFromUrl && (
                  <div>
                    <label className="label" htmlFor="token">Reset Token</label>
                    <div className="input-group">
                      <Lock className="input-icon w-4 h-4" />
                      <input id="token" type="text" className="input pl-11 font-mono text-xs"
                        placeholder="Paste your reset token here"
                        value={token} onChange={e => setToken(e.target.value)} required />
                    </div>
                  </div>
                )}

                <div>
                  <label className="label" htmlFor="newPw">New Password</label>
                  <div className="input-group">
                    <Lock className="input-icon w-4 h-4" />
                    <input id="newPw" type={showPw ? 'text' : 'password'} className="input pl-11 pr-10"
                      placeholder="At least 8 characters"
                      value={newPw} onChange={e => setNewPw(e.target.value)} required minLength={8} />
                    <button type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-runway hover:text-cloud"
                      onClick={() => setShowPw(s => !s)} tabIndex={-1}>
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="confirmPw">Confirm New Password</label>
                  <div className="input-group">
                    <Lock className="input-icon w-4 h-4" />
                    <input id="confirmPw" type={showPw ? 'text' : 'password'} className="input pl-11"
                      placeholder="Repeat new password"
                      value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required />
                  </div>
                </div>

                <button type="submit" className="btn-primary w-full btn-lg mt-2" disabled={loading || !token}>
                  {loading ? <><Loader2 className="w-5 h-5 animate-spin" />Resetting…</> : 'Reset Password'}
                </button>
              </form>
            </>
          )}

          <div className="divider divider-gold mt-6">
            <span className="text-xs text-runway font-heading tracking-widest uppercase">
              Remember it?
            </span>
          </div>
          <Link to="/login" className="btn-ghost w-full text-center mt-4">Back to Sign In</Link>
        </div>
      </div>
    </div>
  );
}
