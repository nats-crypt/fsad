import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Phone, Loader2, Plane, AlertCircle, Check } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Number', ok: /\d/.test(password) },
  ];
  if (!password) return null;
  return (
    <div className="mt-2 space-y-1">
      {checks.map(c => (
        <div key={c.label} className="flex items-center gap-2">
          <Check
            className={`w-3 h-3 ${c.ok ? 'text-jade' : 'text-runway/40'}`}
          />
          <span className={`text-xs ${c.ok ? 'text-jade' : 'text-runway/40'}`}>
            {c.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await register({ email, password, fullName, phone: phone || undefined });
      navigate('/search');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen hero-bg flex items-center justify-center px-4 pt-20 pb-10">
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
            Create your passenger account
          </p>
        </div>

        <div className="card border border-sky-light/30 p-8">
          <h2 className="font-heading text-2xl font-bold tracking-wide text-cloud mb-6">
            Join Horizon
          </h2>

          {error && (
            <div className="flex items-start gap-3 bg-ember/10 border border-ember/30 rounded-lg px-4 py-3 mb-5">
              <AlertCircle className="w-4 h-4 text-ember flex-shrink-0 mt-0.5" />
              <p className="text-sm text-ember">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="fullName">
                Full Name *
              </label>
              <div className="input-group">
                <User className="input-icon w-4 h-4" />
                <input
                  id="fullName"
                  type="text"
                  className="input"
                  placeholder="As per ID/Passport"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="email">
                Email Address *
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
              <label className="label" htmlFor="phone">
                Phone Number (optional)
              </label>
              <div className="input-group">
                <Phone className="input-icon w-4 h-4" />
                <input
                  id="phone"
                  type="tel"
                  className="input"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="password">
                Password *
              </label>
              <div className="input-group">
                <Lock className="input-icon w-4 h-4" />
                <input
                  id="password"
                  type="password"
                  className="input"
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <PasswordStrength password={password} />
            </div>

            <button
              type="submit"
              className="btn-primary w-full btn-lg mt-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating Account…
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="divider divider-gold mt-6">
            <span className="text-xs text-runway font-heading tracking-widest uppercase">
              Already have an account?
            </span>
          </div>

          <Link to="/login" className="btn-ghost w-full text-center mt-4">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
