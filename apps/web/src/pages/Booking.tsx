import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Plane,
  User,
  CreditCard,
  CheckCircle,
  Loader2,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
  Utensils,
  Accessibility,
} from 'lucide-react';
import { api, luhnCheck, validateCardExpiry, formatCardNumber, formatExpiry, ApiError } from '../lib/api';
import SeatMap from '../components/SeatMap';
import type { Flight, PaymentOrder, MockCard } from '../types';
import { formatCurrency, formatTime, formatDate, getDuration, cn } from '../lib/utils';

type Step = 'seat' | 'passenger' | 'payment';

interface PassengerData {
  fullName: string;
  phone: string;
  preferences: {
    meal: string;
    assistance: string;
  };
}

interface PassengerProfile {
  fullName: string;
  phone?: string | null;
  preferences?: {
    meal?: string;
    seatPref?: string;
    assistance?: string;
  } | null;
}

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'seat', label: 'Select Seat' },
    { key: 'passenger', label: 'Passenger' },
    { key: 'payment', label: 'Payment' },
  ];
  const idx = steps.findIndex(s => s.key === current);
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <span key={s.key} className="flex items-center gap-2">
          <span
            className={cn(
              'step',
              i < idx ? 'step-done' : i === idx ? 'step-active' : 'step-pending',
            )}
          >
            <span className="step-num">{i < idx ? '✓' : i + 1}</span>
            <span className="hidden sm:inline">{s.label}</span>
          </span>
          {i < steps.length - 1 && (
            <div className="w-8 h-px bg-sky-light/30" />
          )}
        </span>
      ))}
    </div>
  );
}

export default function Booking() {
  const { flightId } = useParams<{ flightId: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('seat');
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [selectedSeatNo, setSelectedSeatNo] = useState<string>('');

  const [passenger, setPassenger] = useState<PassengerData>({
    fullName: '',
    phone: '',
    preferences: { meal: '', assistance: '' },
  });

  // Load saved profile preferences to pre-fill the passenger step
  const { data: profile } = useQuery<PassengerProfile>({
    queryKey: ['profile'],
    queryFn: () => api.get<PassengerProfile>('/auth/profile'),
    staleTime: 60_000,
  });

  // Pre-fill from profile once it loads (only if fields are still empty)
  useEffect(() => {
    if (!profile) return;
    setPassenger(p => ({
      fullName: p.fullName || profile.fullName || '',
      phone: p.phone || profile.phone || '',
      preferences: {
        meal: p.preferences.meal || profile.preferences?.meal || '',
        assistance: p.preferences.assistance || profile.preferences?.assistance || '',
      },
    }));
  }, [profile]);

  const [card, setCard] = useState<MockCard>({ number: '', expiry: '', cvv: '' });
  const [cardErrors, setCardErrors] = useState<Partial<MockCard>>({});
  const [paymentOrder, setPaymentOrder] = useState<PaymentOrder | null>(null);
  const [bookingError, setBookingError] = useState('');

  const { data: flight, isLoading, isError } = useQuery<Flight>({
    queryKey: ['flight', flightId],
    queryFn: () => api.get<Flight>(`/flights/${flightId}`),
    enabled: !!flightId,
  });

  // Create payment order
  const orderMutation = useMutation({
    mutationFn: () =>
      api.post<PaymentOrder>('/payments/order', {
        flightId,
        seatNo: selectedSeatNo,
      }),
    onSuccess: order => {
      setPaymentOrder(order);
      setStep('payment');
    },
    onError: (err) => {
      if (err instanceof ApiError) setBookingError(err.message);
    },
  });

  // Create booking
  const bookingMutation = useMutation({
    mutationFn: (paymentPayload: unknown) =>
      api.post<{ id: string; pnr: string }>('/bookings', {
        flightId,
        seatNo: selectedSeatNo,
        passenger: {
          fullName: passenger.fullName,
          phone: passenger.phone || undefined,
          preferences: {
            meal: passenger.preferences.meal || undefined,
            assistance: passenger.preferences.assistance || undefined,
          },
        },
        payment: paymentPayload,
      }),
    onSuccess: data => {
      navigate(`/confirmation/${data.id}`);
    },
    onError: err => {
      if (err instanceof ApiError) {
        setBookingError(err.message);
      }
    },
  });

  function validateCard(): boolean {
    const errors: Partial<MockCard> = {};
    const digits = card.number.replace(/\s/g, '');
    if (!luhnCheck(digits)) errors.number = 'Invalid card number';
    if (!validateCardExpiry(card.expiry)) errors.expiry = 'Invalid or expired';
    if (!/^\d{3}$/.test(card.cvv)) errors.cvv = 'Invalid CVV';
    setCardErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handlePaymentSubmit(e: FormEvent) {
    e.preventDefault();
    setBookingError('');

    if (!paymentOrder) return;

    if (paymentOrder.provider === 'razorpay') {
      // Load Razorpay checkout
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => {
        // @ts-expect-error - Razorpay global
        const rzp = new window.Razorpay({
          key: paymentOrder.keyId,
          order_id: paymentOrder.orderId,
          amount: paymentOrder.amount,
          name: 'Horizon Airways',
          description: `Flight ${flight?.flightNo ?? ''} · Seat ${selectedSeatNo}`,
          handler: (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            bookingMutation.mutate({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
          },
        });
        rzp.open();
      };
      document.body.appendChild(script);
    } else {
      // Mock card payment
      if (!validateCard()) return;
      const digits = card.number.replace(/\s/g, '');
      bookingMutation.mutate({
        orderId: paymentOrder.orderId,
        card: { number: digits, expiry: card.expiry, cvv: card.cvv },
      });
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen hero-bg flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-gold animate-spin" />
      </div>
    );
  }

  if (isError || !flight || !flight.origin || !flight.destination) {
    return (
      <div className="min-h-screen hero-bg flex items-center justify-center">
        <div className="card p-8 text-center max-w-md">
          <AlertCircle className="w-10 h-10 text-ember mx-auto mb-4" />
          <p className="font-heading text-xl text-cloud mb-2">Flight Not Found</p>
          <p className="text-runway mb-4">
            The flight you're looking for doesn't exist or is unavailable.
          </p>
          <button onClick={() => navigate('/search')} className="btn-primary">
            Back to Search
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen art-deco-bg pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-runway hover:text-cloud transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to results
          </button>

          <StepIndicator current={step} />
        </div>

        {/* Flight summary */}
        <div className="card border border-gold/20 p-5 mb-6 animate-fade-up animate-delay-100">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-3xl font-heading font-bold text-cloud">
                  {formatTime(flight.departAt)}
                </p>
                <p className="text-xl font-heading font-semibold text-gold">
                  {flight.origin.code}
                </p>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-runway font-mono">
                  {getDuration(flight.departAt, flight.arriveAt)}
                </span>
                <div className="flex items-center gap-1">
                  <div className="w-8 h-px bg-sky-light/40" />
                  <Plane className="w-4 h-4 text-gold" />
                  <div className="w-8 h-px bg-sky-light/40" />
                </div>
                <span className="text-xs text-runway/60 font-mono">
                  {flight.flightNo}
                </span>
              </div>
              <div className="text-center">
                <p className="text-3xl font-heading font-bold text-cloud">
                  {formatTime(flight.arriveAt)}
                </p>
                <p className="text-xl font-heading font-semibold text-gold">
                  {flight.destination.code}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-runway">{formatDate(flight.departAt)}</p>
              <p className="text-2xl font-heading font-bold text-cloud">
                {formatCurrency(flight.baseFare)}
              </p>
              <p className="text-xs text-runway">{flight.aircraft.model}</p>
            </div>
          </div>
        </div>

        {/* Step content */}
        {step === 'seat' && (
          <div className="animate-fade-up">
            <div className="card border border-sky-light/30 p-6 mb-5">
              <h2 className="font-heading text-2xl font-semibold text-cloud mb-5 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center text-xs text-gold font-bold">
                  1
                </span>
                Select Your Seat
              </h2>

              {!flight.seats?.length ? (
                <div className="text-center py-8">
                  <p className="text-runway">Seat map not available. Proceed to continue.</p>
                  <button
                    className="btn-primary mt-4"
                    onClick={() => setStep('passenger')}
                  >
                    Continue Without Seat Selection
                  </button>
                </div>
              ) : (
                <SeatMap
                  seats={flight.seats}
                  selectedSeat={selectedSeatId}
                  onSelect={(id, no) => {
                    setSelectedSeatId(id);
                    setSelectedSeatNo(no);
                  }}
                />
              )}
            </div>

            {selectedSeatId && (
              <div className="flex items-center justify-between card border border-gold/20 p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-jade" />
                  <div>
                    <p className="text-sm text-runway">Selected Seat</p>
                    <p className="font-heading text-xl font-bold text-gold">
                      {selectedSeatNo}
                    </p>
                  </div>
                </div>
                <button
                  className="btn-primary"
                  onClick={() => setStep('passenger')}
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'passenger' && (
          <div className="animate-fade-up">
            <div className="card border border-sky-light/30 p-6">
              <h2 className="font-heading text-2xl font-semibold text-cloud mb-5 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center text-xs text-gold font-bold">
                  2
                </span>
                Passenger Details
              </h2>

              {/* Selected seat summary */}
              {selectedSeatId && (() => {
                const seat = flight.seats?.find(s => s.id === selectedSeatId);
                const cabinLabel = seat?.cabinClass === 'FIRST' ? 'First Class' : seat?.cabinClass === 'BUSINESS' ? 'Business' : 'Economy';
                const badgeClass = seat?.cabinClass === 'FIRST' ? 'badge-gold' : seat?.cabinClass === 'BUSINESS' ? 'badge-blue' : 'badge-gray';
                return (
                  <div className="flex items-center gap-4 bg-sky-mid/40 border border-gold/20 rounded-xl p-4 mb-5">
                    <div className="w-12 h-12 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center">
                      <span className="font-heading text-lg font-bold text-gold">{selectedSeatNo}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-runway uppercase tracking-wider font-heading">Your Seat</p>
                      <p className="font-heading text-cloud font-semibold">Seat {selectedSeatNo}</p>
                      <span className={`badge text-xs mt-0.5 ${badgeClass}`}>{cabinLabel}</span>
                    </div>
                    {seat?.fare && (
                      <div className="text-right">
                        <p className="font-heading text-xl font-bold text-gold">₹{seat.fare.toLocaleString()}</p>
                        <p className="text-xs text-runway">seat fare</p>
                      </div>
                    )}
                    <button
                      type="button"
                      className="btn-ghost text-xs px-2 py-1"
                      onClick={() => setStep('seat')}
                    >
                      Change
                    </button>
                  </div>
                );
              })()}

              <form
                onSubmit={e => {
                  e.preventDefault();
                  orderMutation.mutate();
                }}
                className="space-y-5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="label">Full Name *</label>
                    <div className="input-group">
                      <User className="input-icon w-4 h-4" />
                      <input
                        className="input"
                        placeholder="As per ID/Passport"
                        value={passenger.fullName}
                        onChange={e =>
                          setPassenger(p => ({ ...p, fullName: e.target.value }))
                        }
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Phone Number</label>
                    <input
                      className="input"
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={passenger.phone}
                      onChange={e =>
                        setPassenger(p => ({ ...p, phone: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="gold-line" />

                <h3 className="font-heading text-sm tracking-widest uppercase text-runway flex items-center gap-2">
                  <Utensils className="w-4 h-4" />
                  Preferences (Optional)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Meal</label>
                    <select
                      className="input"
                      value={passenger.preferences.meal}
                      onChange={e =>
                        setPassenger(p => ({
                          ...p,
                          preferences: { ...p.preferences, meal: e.target.value },
                        }))
                      }
                    >
                      <option value="">Standard</option>
                      <option value="VEGETARIAN">Vegetarian</option>
                      <option value="VEGAN">Vegan</option>
                      <option value="JAIN">Jain</option>
                      <option value="KOSHER">Kosher</option>
                      <option value="HALAL">Halal</option>
                      <option value="DIABETIC">Diabetic</option>
                    </select>
                  </div>
                  <div>
                    <label className="label flex items-center gap-1.5">
                      <Accessibility className="w-3 h-3" />
                      Assistance
                    </label>
                    <select
                      className="input"
                      value={passenger.preferences.assistance}
                      onChange={e =>
                        setPassenger(p => ({
                          ...p,
                          preferences: { ...p.preferences, assistance: e.target.value },
                        }))
                      }
                    >
                      <option value="">None required</option>
                      <option value="WHEELCHAIR">Wheelchair</option>
                      <option value="HEARING">Hearing impaired</option>
                      <option value="VISUAL">Visual impaired</option>
                      <option value="MEDICAL">Medical</option>
                    </select>
                  </div>
                </div>

                {bookingError && (
                  <div className="flex items-start gap-3 bg-ember/10 border border-ember/30 rounded-lg px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-ember flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-ember">{bookingError}</p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setStep('seat')}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={orderMutation.isPending || !passenger.fullName}
                  >
                    {orderMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing…
                      </>
                    ) : (
                      <>
                        Proceed to Payment
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {step === 'payment' && paymentOrder && (
          <div className="animate-fade-up">
            <div className="card border border-sky-light/30 p-6">
              <h2 className="font-heading text-2xl font-semibold text-cloud mb-5 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center text-xs text-gold font-bold">
                  3
                </span>
                Payment
              </h2>

              {/* Order summary */}
              <div className="bg-sky-mid/40 rounded-xl p-4 mb-5 border border-sky-light/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-runway">
                      {flight.origin.code} → {flight.destination.code} ·{' '}
                      {formatDate(flight.departAt)}
                    </p>
                    <p className="font-heading font-semibold text-cloud">
                      Seat {selectedSeatNo} · {passenger.fullName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-heading text-2xl font-bold text-gold">
                      {formatCurrency(paymentOrder.amount / 100)}
                    </p>
                    <p className="text-xs text-runway">Total amount</p>
                  </div>
                </div>
              </div>

              {paymentOrder.provider === 'mock' ? (
                <form onSubmit={handlePaymentSubmit} className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="w-4 h-4 text-gold" />
                    <span className="font-heading text-sm tracking-wider uppercase text-runway">
                      Card Details
                    </span>
                    <span className="badge badge-gray text-xs ml-auto">Mock / Test</span>
                  </div>

                  <div>
                    <label className="label">Card Number</label>
                    <input
                      className={cn('input font-mono', cardErrors.number && 'border-ember/60')}
                      placeholder="4539 1488 0343 6467"
                      value={card.number}
                      onChange={e =>
                        setCard(c => ({ ...c, number: formatCardNumber(e.target.value) }))
                      }
                      maxLength={19}
                      inputMode="numeric"
                    />
                    {cardErrors.number && (
                      <p className="text-xs text-ember mt-1">{cardErrors.number}</p>
                    )}
                    <p className="text-xs text-runway/50 mt-1 font-mono">
                      Test: 4539 1488 0343 6467 (success) · ends 0002 (decline)
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Expiry (MM/YY)</label>
                      <input
                        className={cn('input font-mono', cardErrors.expiry && 'border-ember/60')}
                        placeholder="12/28"
                        value={card.expiry}
                        onChange={e =>
                          setCard(c => ({ ...c, expiry: formatExpiry(e.target.value) }))
                        }
                        maxLength={5}
                        inputMode="numeric"
                      />
                      {cardErrors.expiry && (
                        <p className="text-xs text-ember mt-1">{cardErrors.expiry}</p>
                      )}
                    </div>
                    <div>
                      <label className="label">CVV</label>
                      <input
                        className={cn('input font-mono', cardErrors.cvv && 'border-ember/60')}
                        placeholder="123"
                        value={card.cvv}
                        onChange={e =>
                          setCard(c => ({
                            ...c,
                            cvv: e.target.value.replace(/\D/g, '').slice(0, 3),
                          }))
                        }
                        maxLength={3}
                        inputMode="numeric"
                        type="password"
                      />
                      {cardErrors.cvv && (
                        <p className="text-xs text-ember mt-1">{cardErrors.cvv}</p>
                      )}
                    </div>
                  </div>

                  {bookingError && (
                    <div className="flex items-start gap-3 bg-ember/10 border border-ember/30 rounded-lg px-4 py-3">
                      <AlertCircle className="w-4 h-4 text-ember flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-ember">{bookingError}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setStep('passenger')}
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                    <button
                      type="submit"
                      className="btn-primary btn-lg"
                      disabled={bookingMutation.isPending}
                    >
                      {bookingMutation.isPending ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Confirming…
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-5 h-5" />
                          Pay {formatCurrency(paymentOrder.amount / 100)}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="card border border-gold/20 p-5 text-center">
                    <p className="text-sm text-runway mb-3">
                      You'll be redirected to Razorpay secure checkout
                    </p>
                    <p className="font-heading text-2xl font-bold text-gold mb-4">
                      {formatCurrency(paymentOrder.amount / 100)}
                    </p>
                    {bookingError && (
                      <div className="flex items-start gap-3 bg-ember/10 border border-ember/30 rounded-lg px-4 py-3 mb-4 text-left">
                        <AlertCircle className="w-4 h-4 text-ember flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-ember">{bookingError}</p>
                      </div>
                    )}
                    <button
                      className="btn-primary btn-lg w-full"
                      onClick={e => handlePaymentSubmit(e as unknown as FormEvent)}
                      disabled={bookingMutation.isPending}
                    >
                      {bookingMutation.isPending ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Processing…
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-5 h-5" />
                          Pay with Razorpay
                        </>
                      )}
                    </button>
                  </div>
                  <button
                    className="btn-ghost"
                    onClick={() => setStep('passenger')}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
