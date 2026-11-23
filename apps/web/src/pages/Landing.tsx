import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Plane,
  MapPin,
  Calendar,
  Users,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Search,
  Zap,
} from 'lucide-react';
import { cn, dateIST, todayIST } from '../lib/utils';

const FEATURED_ROUTES = [
  { from: 'DEL', fromCity: 'Delhi', to: 'BOM', toCity: 'Mumbai', price: 3999, duration: '2h 10m' },
  { from: 'BOM', fromCity: 'Mumbai', to: 'BLR', toCity: 'Bangalore', price: 2499, duration: '1h 40m' },
  { from: 'DEL', fromCity: 'Delhi', to: 'MAA', toCity: 'Chennai', price: 4799, duration: '2h 55m' },
  { from: 'BLR', fromCity: 'Bangalore', to: 'HYD', toCity: 'Hyderabad', price: 1899, duration: '1h 05m' },
  { from: 'CCU', fromCity: 'Kolkata', to: 'DEL', toCity: 'Delhi', price: 3299, duration: '2h 20m' },
  { from: 'BOM', fromCity: 'Mumbai', to: 'HYD', toCity: 'Hyderabad', price: 2199, duration: '1h 25m' },
];

const AIRPORTS = ['DEL', 'BOM', 'BLR', 'HYD', 'MAA', 'CCU'];

export default function Landing() {
  const navigate = useNavigate();
  const [nlMode, setNlMode] = useState(false);
  const [nlQuery, setNlQuery] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return dateIST(d);
  });
  const [pax, setPax] = useState(1);

  function handleClassicSearch(e: FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams();
    if (origin) sp.set('origin', origin);
    if (destination) sp.set('destination', destination);
    if (date) sp.set('date', date);
    sp.set('pax', String(pax));
    navigate(`/search?${sp.toString()}`);
  }

  function handleNlSearch(e: FormEvent) {
    e.preventDefault();
    if (nlQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(nlQuery)}`);
    }
  }

  return (
    <div className="min-h-screen">
      {/* ===== HERO ===== */}
      <section className="relative min-h-screen flex flex-col items-center justify-center hero-bg overflow-hidden pt-20">
        {/* Background geometric decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Large compass-like circle */}
          <div
            className="absolute -top-32 -right-32 w-[600px] h-[600px] geo-circle opacity-10 animate-spin-slow"
            style={{
              background: 'transparent',
              border: '1px solid rgba(201, 160, 64, 0.4)',
            }}
          />
          <div
            className="absolute -top-24 -right-24 w-[500px] h-[500px] geo-circle opacity-5"
            style={{ border: '1px solid rgba(201, 160, 64, 0.6)' }}
          />
          {/* Bottom left arc */}
          <div
            className="absolute -bottom-40 -left-40 w-[480px] h-[480px] geo-circle opacity-10"
            style={{ border: '1px solid rgba(46, 134, 193, 0.5)' }}
          />

          {/* Diagonal lines */}
          <div
            className="absolute top-0 left-0 right-0"
            style={{
              height: '1px',
              background:
                'linear-gradient(90deg, transparent 0%, rgba(201,160,64,0.2) 30%, rgba(201,160,64,0.6) 50%, rgba(201,160,64,0.2) 70%, transparent 100%)',
              top: '40%',
            }}
          />

          {/* Floating particles */}
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full bg-gold/30 animate-float"
              style={{
                left: `${15 + i * 15}%`,
                top: `${20 + (i % 3) * 20}%`,
                animationDelay: `${i * 0.8}s`,
                animationDuration: `${4 + i * 0.5}s`,
              }}
            />
          ))}
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center stagger-reveal">
          {/* Pre-title */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-gold/60" />
            <span className="badge badge-gold text-xs tracking-widest">
              <Sparkles className="w-3 h-3" />
              India's Premier Carrier
            </span>
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-gold/60" />
          </div>

          {/* Main headline */}
          <h1
            className="text-6xl md:text-8xl lg:text-9xl font-heading font-bold uppercase tracking-tight text-cloud mb-4"
            style={{ lineHeight: 0.9 }}
          >
            Fly{' '}
            <span
              className="font-display italic"
              style={{
                background: 'linear-gradient(90deg, #C9A040, #E8C87A, #C9A040)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundSize: '200% 100%',
                animation: 'shimmer 3s linear infinite',
              }}
            >
              Higher
            </span>
          </h1>

          <p className="font-display text-2xl md:text-3xl italic text-runway mb-2">
            Dream Bigger.
          </p>

          <p className="text-sm text-runway/70 font-body max-w-lg mx-auto mb-10 leading-relaxed">
            Book flights across India with AI-powered search, real-time pricing,
            and a boarding experience like never before.
          </p>

          {/* Search widget */}
          <div className="card max-w-3xl mx-auto p-5">
            {/* Mode toggle */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setNlMode(false)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-heading tracking-wider uppercase transition-all',
                  !nlMode
                    ? 'bg-gold/15 text-gold border border-gold/30'
                    : 'text-runway hover:text-cloud',
                )}
              >
                <Search className="w-3.5 h-3.5" />
                Classic
              </button>
              <button
                onClick={() => setNlMode(true)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-heading tracking-wider uppercase transition-all',
                  nlMode
                    ? 'bg-gold/15 text-gold border border-gold/30'
                    : 'text-runway hover:text-cloud',
                )}
              >
                <Zap className="w-3.5 h-3.5" />
                AI Search
              </button>
            </div>

            {nlMode ? (
              <form onSubmit={handleNlSearch} className="flex gap-3">
                <div className="flex-1 input-group">
                  <Sparkles className="input-icon w-4 h-4 text-gold" />
                  <input
                    className="input pl-11"
                    placeholder='e.g. "Cheap morning flight to Mumbai next Friday"'
                    value={nlQuery}
                    onChange={e => setNlQuery(e.target.value)}
                    autoFocus
                  />
                </div>
                <button type="submit" className="btn-primary flex-shrink-0">
                  <Search className="w-4 h-4" />
                  Search
                </button>
              </form>
            ) : (
              <form onSubmit={handleClassicSearch}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="label">From</label>
                    <div className="input-group">
                      <MapPin className="input-icon w-4 h-4" />
                      <select
                        className="input pl-11"
                        value={origin}
                        onChange={e => setOrigin(e.target.value)}
                      >
                        <option value="">Any</option>
                        {AIRPORTS.map(a => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">To</label>
                    <div className="input-group">
                      <MapPin className="input-icon w-4 h-4" />
                      <select
                        className="input pl-11"
                        value={destination}
                        onChange={e => setDestination(e.target.value)}
                      >
                        <option value="">Any</option>
                        {AIRPORTS.map(a => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">Date</label>
                    <div className="input-group">
                      <Calendar className="input-icon w-4 h-4" />
                      <input
                        type="date"
                        className="input pl-11"
                        value={date}
                        min={todayIST()}
                        onChange={e => {
                          const v = e.target.value;
                          const t = todayIST();
                          setDate(!v || v < t ? t : v);
                        }}
                        onBlur={e => {
                          const v = e.target.value;
                          const t = todayIST();
                          if (!v || v < t) setDate(t);
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Passengers</label>
                    <div className="input-group">
                      <Users className="input-icon w-4 h-4" />
                      <input
                        type="number"
                        className="input pl-11"
                        min={1}
                        max={9}
                        value={pax}
                        onChange={e => setPax(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  className="btn-primary w-full mt-3 btn-lg"
                >
                  <Search className="w-5 h-5" />
                  Search Flights
                </button>
              </form>
            )}
          </div>

          {/* Quick links */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            {['DEL→BOM', 'BOM→BLR', 'DEL→MAA', 'CCU→DEL'].map(route => {
              const [from, to] = route.split('→');
              return (
                <button
                  key={route}
                  onClick={() =>
                    navigate(
                      `/search?origin=${from}&destination=${to}&date=${date}`,
                    )
                  }
                  className="text-xs text-runway/60 hover:text-gold transition-colors font-mono px-3 py-1 rounded-full border border-sky-light/20 hover:border-gold/30"
                >
                  {route}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
          <div className="w-5 h-8 rounded-full border border-runway/40 flex justify-center pt-1.5">
            <div className="w-1 h-1.5 bg-runway rounded-full animate-bounce" />
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14 stagger-reveal">
          <p className="text-xs font-heading tracking-widest uppercase text-gold mb-2">
            Why Fly With Us
          </p>
          <h2 className="section-title mb-3">The Horizon Advantage</h2>
          <div className="gold-line max-w-xs mx-auto" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 stagger-reveal">
          {[
            {
              icon: '✦',
              title: 'AI-Powered Search',
              desc: 'Ask in plain English. Our AI understands "cheap morning flight to Mumbai" and finds it instantly.',
            },
            {
              icon: '◈',
              title: 'Visual Seat Selection',
              desc: 'Interactive cabin maps with live availability. First Class, Business, and Economy at a glance.',
            },
            {
              icon: '⬡',
              title: 'Instant E-Tickets',
              desc: 'Boarding pass-style digital tickets generated immediately. Print or save as PDF.',
            },
            {
              icon: '⟐',
              title: 'Smart Rebooking',
              desc: 'Cancelled? Our AI suggests the best alternatives ranked by fare and schedule proximity.',
            },
            {
              icon: '◉',
              title: 'Fare Forecasting',
              desc: 'Know whether prices are rising or falling before you book. Never overpay again.',
            },
            {
              icon: '⊞',
              title: 'Secure Payments',
              desc: 'Razorpay-powered checkout with real-time Luhn card validation and instant confirmation.',
            },
          ].map((f, i) => (
            <div
              key={i}
              className="card-hover p-6 flex flex-col gap-4 group"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="text-3xl text-gold">{f.icon}</div>
              <div>
                <h3 className="font-heading text-lg font-semibold tracking-wide text-cloud mb-2">
                  {f.title}
                </h3>
                <p className="text-sm text-runway leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FEATURED ROUTES ===== */}
      <section className="py-20 bg-sky-darkest/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-10">
            <div>
              <p className="text-xs font-heading tracking-widest uppercase text-gold mb-1">
                Popular Routes
              </p>
              <h2 className="section-title">Top Destinations</h2>
            </div>
            <Link
              to="/search"
              className="btn-secondary btn-sm hidden sm:flex"
            >
              All Flights
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-reveal">
            {FEATURED_ROUTES.map((route, i) => (
              <Link
                key={i}
                to={`/search?origin=${route.from}&destination=${route.to}&date=${date}`}
                className="flight-card group flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-heading text-2xl font-bold text-cloud">
                      {route.from}
                    </p>
                    <p className="text-xs text-runway">{route.fromCity}</p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1">
                      <div className="w-5 h-px bg-sky-light/40" />
                      <Plane className="w-3 h-3 text-gold" />
                      <div className="w-5 h-px bg-sky-light/40" />
                    </div>
                    <span className="text-xs text-runway/60 font-mono">
                      {route.duration}
                    </span>
                  </div>
                  <div>
                    <p className="font-heading text-2xl font-bold text-cloud">
                      {route.to}
                    </p>
                    <p className="text-xs text-runway">{route.toCity}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-runway">from</p>
                  <p className="font-heading text-lg font-bold text-gold">
                    ₹{route.price.toLocaleString('en-IN')}
                  </p>
                  <ArrowRight className="w-4 h-4 text-runway/40 mt-1 ml-auto group-hover:text-gold transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-gold/5 via-gold/10 to-gold/5 rounded-3xl" />
            <div className="relative card border-gold/20 p-12">
              <p className="font-display text-lg italic text-runway mb-3">
                Ready to take off?
              </p>
              <h2 className="text-5xl font-heading font-bold uppercase tracking-wider text-cloud mb-6">
                Your Next Adventure Awaits
              </h2>
              <p className="text-runway mb-8 max-w-md mx-auto">
                Join thousands of passengers who trust Horizon Airways for their
                journeys across India.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link to="/register" className="btn-primary btn-lg">
                  <Sparkles className="w-5 h-5" />
                  Create Account
                </Link>
                <Link to="/search" className="btn-secondary btn-lg">
                  <Search className="w-5 h-5" />
                  Search Flights
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
