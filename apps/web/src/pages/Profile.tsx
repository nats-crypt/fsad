import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  Phone,
  Mail,
  Utensils,
  Armchair,
  HeartHandshake,
  Save,
  CheckCircle,
  AlertCircle,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Globe,
  CreditCard,
  MapPin,
  Calendar,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { todayIST } from '../lib/utils';

interface PassengerProfile {
  id: string;
  fullName: string;
  phone?: string | null;
  dob?: string | null;
  nationality?: string | null;
  passportMasked?: string | null;
  address?: string | null;
  preferences?: {
    meal?: string;
    seatPref?: string;
    assistance?: string;
  } | null;
}

const MEAL_OPTIONS = [
  { value: '', label: 'No preference' },
  { value: 'VEG', label: 'Vegetarian' },
  { value: 'NON_VEG', label: 'Non-Vegetarian' },
  { value: 'VEGAN', label: 'Vegan' },
  { value: 'JAIN', label: 'Jain' },
  { value: 'HALAL', label: 'Halal' },
  { value: 'KOSHER', label: 'Kosher' },
  { value: 'GLUTEN_FREE', label: 'Gluten-Free' },
];

const SEAT_OPTIONS = [
  { value: '', label: 'No preference' },
  { value: 'WINDOW', label: 'Window' },
  { value: 'AISLE', label: 'Aisle' },
  { value: 'MIDDLE', label: 'Middle' },
  { value: 'FRONT', label: 'Front of cabin' },
  { value: 'EXIT_ROW', label: 'Exit row (extra legroom)' },
];

const ASSISTANCE_OPTIONS = [
  { value: '', label: 'None required' },
  { value: 'WHEELCHAIR', label: 'Wheelchair assistance' },
  { value: 'VISUAL', label: 'Visual impairment assistance' },
  { value: 'HEARING', label: 'Hearing impairment assistance' },
  { value: 'INFANT', label: 'Travelling with infant' },
  { value: 'UNACCOMPANIED_MINOR', label: 'Unaccompanied minor' },
];

export default function Profile() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery<PassengerProfile>({
    queryKey: ['profile'],
    queryFn: () => api.get<PassengerProfile>('/auth/profile'),
    enabled: !!user && user.role === 'PASSENGER',
  });

  // Personal details state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [nationality, setNationality] = useState('');
  const [passportNo, setPassportNo] = useState('');
  const [address, setAddress] = useState('');
  // Travel preferences
  const [meal, setMeal] = useState('');
  const [seatPref, setSeatPref] = useState('');
  const [assistance, setAssistance] = useState('');
  const [saved, setSaved] = useState(false);

  // Change password state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState('');

  const pwMutation = useMutation({
    mutationFn: () =>
      api.post('/auth/change-password', {
        currentPassword: currentPw,
        newPassword: newPw,
      }),
    onSuccess: () => {
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setPwError('');
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 3000);
    },
    onError: (err: Error) => {
      setPwError(err.message ?? 'Failed to change password');
    },
  });

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.fullName ?? '');
    setPhone(profile.phone ?? '');
    // dob comes as ISO string — keep only the date part for input[type=date]
    setDob(profile.dob ? profile.dob.split('T')[0] : '');
    setNationality(profile.nationality ?? '');
    // passport is always masked by backend; clear field so user can enter new value
    setPassportNo('');
    setAddress(profile.address ?? '');
    setMeal(profile.preferences?.meal ?? '');
    setSeatPref(profile.preferences?.seatPref ?? '');
    setAssistance(profile.preferences?.assistance ?? '');
  }, [profile]);

  const mutation = useMutation({
    mutationFn: () =>
      api.patch<PassengerProfile>('/auth/profile', {
        fullName: fullName.trim() || undefined,
        phone: phone.trim() || null,
        dob: dob || null,
        nationality: nationality.trim() || null,
        // only send passportNo if user typed something new
        passportNo: passportNo.trim() || undefined,
        address: address.trim() || null,
        preferences: {
          meal: meal || undefined,
          seatPref: seatPref || undefined,
          assistance: assistance || undefined,
        },
      }),
    onSuccess: (data) => {
      qc.setQueryData(['profile'], data);
      setPassportNo(''); // clear after save so masking shows on next load
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen art-deco-bg pt-24 pb-16 flex items-center justify-center">
        <Loader2 className="w-9 h-9 text-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen art-deco-bg pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <p className="text-xs font-heading tracking-widest uppercase text-gold mb-1">Account</p>
          <h1 className="section-title">My Profile</h1>
          <div className="gold-line-left w-24 mt-2" />
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
          className="space-y-6 animate-fade-up animate-delay-100"
        >
          {/* Personal Details */}
          <div className="card border border-sky-light/30 p-6">
            <h2 className="font-heading text-sm tracking-widest uppercase text-gold mb-5 flex items-center gap-2">
              <User className="w-4 h-4" />
              Personal Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="label">Full Name</label>
                <div className="input-group">
                  <User className="input-icon w-4 h-4" />
                  <input className="input pl-11" placeholder="Your full name"
                    value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
              </div>

              <div>
                <label className="label">Email</label>
                <div className="input-group opacity-60">
                  <Mail className="input-icon w-4 h-4" />
                  <input className="input pl-11" value={user?.email ?? ''} disabled readOnly />
                </div>
                <p className="text-xs text-runway mt-1">Email cannot be changed</p>
              </div>

              <div>
                <label className="label">Phone Number</label>
                <div className="input-group">
                  <Phone className="input-icon w-4 h-4" />
                  <input className="input pl-11" placeholder="+91 98765 43210"
                    value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Date of Birth</label>
                  <div className="input-group">
                    <Calendar className="input-icon w-4 h-4" />
                    <input className="input pl-11" type="date"
                      value={dob} onChange={(e) => setDob(e.target.value)}
                      max={todayIST()} />
                  </div>
                </div>
                <div>
                  <label className="label">Nationality</label>
                  <div className="input-group">
                    <Globe className="input-icon w-4 h-4" />
                    <input className="input pl-11" placeholder="e.g. Indian"
                      value={nationality} onChange={(e) => setNationality(e.target.value)} />
                  </div>
                </div>
              </div>

              <div>
                <label className="label flex items-center gap-1.5">
                  Passport / ID Number
                  <span className="flex items-center gap-1 text-xs text-jade font-normal normal-case tracking-normal">
                    <ShieldCheck className="w-3 h-3" /> encrypted at rest
                  </span>
                </label>
                {profile?.passportMasked && !passportNo && (
                  <p className="text-xs text-runway mb-1.5 font-mono">
                    Stored: <span className="text-cloud">{profile.passportMasked}</span>
                    {' '}— type a new value to update
                  </p>
                )}
                <div className="input-group">
                  <CreditCard className="input-icon w-4 h-4" />
                  <input className="input pl-11 font-mono" placeholder="A1234567 (leave blank to keep current)"
                    value={passportNo} onChange={(e) => setPassportNo(e.target.value.toUpperCase())} />
                </div>
              </div>

              <div>
                <label className="label">Address</label>
                <div className="input-group">
                  <MapPin className="input-icon w-4 h-4 mt-2.5 self-start" />
                  <textarea className="input pl-11 resize-none" rows={2}
                    placeholder="Your home address"
                    value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Travel Preferences */}
          <div className="card border border-sky-light/30 p-6">
            <h2 className="font-heading text-sm tracking-widest uppercase text-gold mb-1 flex items-center gap-2">
              <Utensils className="w-4 h-4" />
              Travel Preferences
            </h2>
            <p className="text-xs text-runway mb-5">
              Saved to your profile and pre-filled when you book a flight.
            </p>
            <div className="space-y-4">
              <div>
                <label className="label flex items-center gap-2">
                  <Utensils className="w-3.5 h-3.5" /> Meal Preference
                </label>
                <select className="input" value={meal} onChange={(e) => setMeal(e.target.value)}>
                  {MEAL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label flex items-center gap-2">
                  <Armchair className="w-3.5 h-3.5" /> Seat Preference
                </label>
                <select className="input" value={seatPref} onChange={(e) => setSeatPref(e.target.value)}>
                  {SEAT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label flex items-center gap-2">
                  <HeartHandshake className="w-3.5 h-3.5" /> Special Assistance
                </label>
                <select className="input" value={assistance} onChange={(e) => setAssistance(e.target.value)}>
                  {ASSISTANCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-4">
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-400 animate-fade-in">
                <CheckCircle className="w-4 h-4" /> Saved successfully
              </span>
            )}
            {mutation.isError && (
              <span className="flex items-center gap-1.5 text-sm text-ember animate-fade-in">
                <AlertCircle className="w-4 h-4" /> Failed to save. Please try again.
              </span>
            )}
          </div>
        </form>

        {/* Change Password */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPwError('');
            if (newPw.length < 8) { setPwError('New password must be at least 8 characters'); return; }
            if (newPw !== confirmPw) { setPwError('Passwords do not match'); return; }
            pwMutation.mutate();
          }}
          className="card border border-sky-light/30 p-6 mt-6 animate-fade-up animate-delay-200"
        >
          <h2 className="font-heading text-sm tracking-widest uppercase text-gold mb-5 flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Change Password
          </h2>
          <div className="space-y-4">
            <div>
              <label className="label">Current Password</label>
              <div className="input-group">
                <Lock className="input-icon w-4 h-4" />
                <input className="input pl-11 pr-10" type={showPw ? 'text' : 'password'}
                  placeholder="Your current password"
                  value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required />
                <button type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-runway hover:text-cloud"
                  onClick={() => setShowPw(s => !s)} tabIndex={-1}>
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">New Password</label>
              <div className="input-group">
                <Lock className="input-icon w-4 h-4" />
                <input className="input pl-11" type={showPw ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={8} />
              </div>
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <div className="input-group">
                <Lock className="input-icon w-4 h-4" />
                <input className="input pl-11" type={showPw ? 'text' : 'password'}
                  placeholder="Repeat new password"
                  value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required />
              </div>
            </div>

            {pwError && (
              <div className="flex items-center gap-2 text-sm text-ember">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {pwError}
              </div>
            )}

            <div className="flex items-center gap-4 pt-1">
              <button type="submit" className="btn-primary" disabled={pwMutation.isPending}>
                {pwMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Change Password
              </button>
              {pwSaved && (
                <span className="flex items-center gap-1.5 text-sm text-emerald-400 animate-fade-in">
                  <CheckCircle className="w-4 h-4" /> Password updated
                </span>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
