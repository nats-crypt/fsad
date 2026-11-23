import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail, Lock, User, Phone, Loader2, Plane, AlertCircle, Check,
  Globe, CreditCard, MapPin, Calendar, Eye, EyeOff,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';
import { todayIST, cn } from '../lib/utils';

// ─── Validation rules ────────────────────────────────────────────────────────

function validateFullName(v: string) {
  if (!v.trim()) return 'Full name is required';
  if (v.trim().length < 2) return 'Enter your full name (at least 2 characters)';
  if (!/^[A-Za-z\s'\-\.]+$/.test(v.trim())) return 'Only letters and spaces allowed';
  return '';
}

function validateEmail(v: string) {
  if (!v.trim()) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email address';
  return '';
}

function validatePassword(v: string) {
  if (!v) return 'Password is required';
  if (v.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(v)) return 'Password must contain at least one uppercase letter';
  if (!/\d/.test(v)) return 'Password must contain at least one number';
  return '';
}

function validateConfirmPassword(v: string, password: string) {
  if (!v) return 'Please confirm your password';
  if (v !== password) return 'Passwords do not match';
  return '';
}

function validatePhone(v: string) {
  if (!v) return '';
  const digits = v.replace(/\D/g, '');
  if (digits.length < 10) return 'Enter a valid phone number (at least 10 digits)';
  return '';
}

// ─── Password strength indicator ────────────────────────────────────────────

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
          <Check className={`w-3 h-3 ${c.ok ? 'text-jade' : 'text-runway/40'}`} />
          <span className={`text-xs ${c.ok ? 'text-jade' : 'text-runway/40'}`}>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

function FieldError({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <p className="text-xs text-ember mt-1 flex items-center gap-1">
      <AlertCircle className="w-3 h-3 flex-shrink-0" />
      {msg}
    </p>
  );
}

// ─── Register page ───────────────────────────────────────────────────────────

type Touched = Record<string, boolean>;

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [nationality, setNationality] = useState('');
  const [passportNo, setPassportNo] = useState('');
  const [address, setAddress] = useState('');

  const [touched, setTouched] = useState<Touched>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function touch(field: string) {
    setTouched(t => ({ ...t, [field]: true }));
  }

  const errors = {
    fullName: validateFullName(fullName),
    email: validateEmail(email),
    password: validatePassword(password),
    confirmPassword: validateConfirmPassword(confirmPassword, password),
    phone: validatePhone(phone),
  };

  const hasErrors = Object.values(errors).some(Boolean);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched({ fullName: true, email: true, password: true, confirmPassword: true, phone: true });
    if (hasErrors) return;
    setError('');
    setLoading(true);
    try {
      await register({
        email,
        password,
        fullName,
        phone: phone || undefined,
        dob: dob || undefined,
        nationality: nationality || undefined,
        passportNo: passportNo || undefined,
        address: address || undefined,
      });
      navigate('/search');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen hero-bg flex items-center justify-center px-4 pt-20 pb-10">
      <div className="w-full max-w-lg relative z-10 animate-fade-up">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mb-4 shadow-gold">
            <Plane className="w-7 h-7 text-gold -rotate-45" />
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-widest uppercase text-cloud">
            Horizon Airways
          </h1>
          <p className="font-display text-sm italic text-runway mt-1">Create your passenger account</p>
        </div>

        <div className="card border border-sky-light/30 p-8">
          <h2 className="font-heading text-2xl font-bold tracking-wide text-cloud mb-6">Join Horizon</h2>

          {error && (
            <div className="flex items-start gap-3 bg-ember/10 border border-ember/30 rounded-lg px-4 py-3 mb-5">
              <AlertCircle className="w-4 h-4 text-ember flex-shrink-0 mt-0.5" />
              <p className="text-sm text-ember">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Account credentials */}
            <div>
              <p className="text-xs font-heading tracking-widest uppercase text-gold mb-3">Account</p>
              <div className="space-y-4">
                {/* Full name */}
                <div>
                  <label className="label" htmlFor="fullName">Full Name *</label>
                  <div className="input-group">
                    <User className={cn('input-icon w-4 h-4', touched.fullName && errors.fullName && 'text-ember')} />
                    <input
                      id="fullName"
                      type="text"
                      className={cn('input', touched.fullName && errors.fullName && 'border-ember/60 focus:border-ember')}
                      placeholder="As per ID / Passport"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      onBlur={() => touch('fullName')}
                      autoComplete="name"
                    />
                  </div>
                  {touched.fullName && <FieldError msg={errors.fullName} />}
                </div>

                {/* Email */}
                <div>
                  <label className="label" htmlFor="email">Email Address *</label>
                  <div className="input-group">
                    <Mail className={cn('input-icon w-4 h-4', touched.email && errors.email && 'text-ember')} />
                    <input
                      id="email"
                      type="email"
                      className={cn('input', touched.email && errors.email && 'border-ember/60 focus:border-ember')}
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onBlur={() => touch('email')}
                      autoComplete="email"
                    />
                  </div>
                  {touched.email && <FieldError msg={errors.email} />}
                </div>

                {/* Password */}
                <div>
                  <label className="label" htmlFor="password">Password *</label>
                  <div className="input-group">
                    <Lock className={cn('input-icon w-4 h-4', touched.password && errors.password && 'text-ember')} />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      className={cn('input pr-10', touched.password && errors.password && 'border-ember/60 focus:border-ember')}
                      placeholder="Min 8 chars, 1 uppercase, 1 number"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onBlur={() => touch('password')}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-runway/50 hover:text-runway transition-colors"
                      onClick={() => setShowPassword(s => !s)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {touched.password && errors.password
                    ? <FieldError msg={errors.password} />
                    : <PasswordStrength password={password} />}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="label" htmlFor="confirmPassword">Confirm Password *</label>
                  <div className="input-group">
                    <Lock className={cn('input-icon w-4 h-4', touched.confirmPassword && errors.confirmPassword && 'text-ember')} />
                    <input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      className={cn('input', touched.confirmPassword && errors.confirmPassword && 'border-ember/60 focus:border-ember')}
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      onBlur={() => touch('confirmPassword')}
                      autoComplete="new-password"
                    />
                  </div>
                  {touched.confirmPassword && <FieldError msg={errors.confirmPassword} />}
                  {touched.confirmPassword && !errors.confirmPassword && confirmPassword && (
                    <p className="text-xs text-jade mt-1 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Passwords match
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="gold-line" />

            {/* Personal details */}
            <div>
              <p className="text-xs font-heading tracking-widest uppercase text-gold mb-1">Personal Details</p>
              <p className="text-xs text-runway mb-3">Optional — stored securely and used on your e-tickets.</p>
              <div className="space-y-4">
                <div>
                  <label className="label" htmlFor="phone">Phone Number</label>
                  <div className="input-group">
                    <Phone className={cn('input-icon w-4 h-4', touched.phone && errors.phone && 'text-ember')} />
                    <input
                      id="phone"
                      type="tel"
                      className={cn('input', touched.phone && errors.phone && 'border-ember/60 focus:border-ember')}
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      onBlur={() => touch('phone')}
                      autoComplete="tel"
                    />
                  </div>
                  {touched.phone && <FieldError msg={errors.phone} />}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label" htmlFor="dob">Date of Birth</label>
                    <div className="input-group">
                      <Calendar className="input-icon w-4 h-4" />
                      <input
                        id="dob"
                        type="date"
                        className="input pl-11"
                        value={dob}
                        onChange={e => setDob(e.target.value)}
                        max={todayIST()}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="nationality">Nationality</label>
                    <div className="input-group">
                      <Globe className="input-icon w-4 h-4" />
                      <input
                        id="nationality"
                        type="text"
                        className="input pl-11"
                        placeholder="e.g. Indian"
                        value={nationality}
                        onChange={e => setNationality(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="passportNo">
                    Passport / ID Number
                    <span className="ml-2 text-xs text-runway font-normal normal-case tracking-normal">
                      (encrypted at rest)
                    </span>
                  </label>
                  <div className="input-group">
                    <CreditCard className="input-icon w-4 h-4" />
                    <input
                      id="passportNo"
                      type="text"
                      className="input pl-11 font-mono"
                      placeholder="A1234567"
                      value={passportNo}
                      onChange={e => setPassportNo(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="address">Address</label>
                  <div className="input-group">
                    <MapPin className="input-icon w-4 h-4 mt-2.5 self-start" />
                    <textarea
                      id="address"
                      className="input pl-11 resize-none"
                      rows={2}
                      placeholder="Your home address"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full btn-lg mt-2" disabled={loading}>
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" />Creating Account…</> : 'Create Account'}
            </button>
          </form>

          <div className="divider divider-gold mt-6">
            <span className="text-xs text-runway font-heading tracking-widest uppercase">Already have an account?</span>
          </div>
          <Link to="/login" className="btn-ghost w-full text-center mt-4">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
