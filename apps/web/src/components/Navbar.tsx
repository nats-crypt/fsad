import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Plane,
  Menu,
  X,
  LogOut,
  User,
  LayoutDashboard,
  Ticket,
  ChevronDown,
  Settings,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/utils';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'STAFF';

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-40 transition-all duration-300 no-print',
        scrolled
          ? 'glass border-b border-sky-light/20 py-3'
          : 'bg-transparent py-5',
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative w-9 h-9">
            <div className="absolute inset-0 rounded-full bg-gold/10 border border-gold/30 group-hover:bg-gold/20 transition-colors" />
            <Plane className="absolute inset-0 m-auto w-5 h-5 text-gold transform -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
          </div>
          <div>
            <span className="font-heading text-lg font-bold tracking-widest uppercase text-cloud">
              Horizon
            </span>
            <span className="font-display text-sm text-gold ml-1 italic">Airways</span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          <NavLink
            to="/search"
            className={({ isActive }) =>
              cn('nav-link', isActive && 'active')
            }
          >
            Flights
          </NavLink>
          {user && !isAdmin && (
            <NavLink
              to="/my-bookings"
              className={({ isActive }) =>
                cn('nav-link', isActive && 'active')
              }
            >
              My Bookings
            </NavLink>
          )}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                cn('nav-link', isActive && 'active')
              }
            >
              Admin
            </NavLink>
          )}
        </nav>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl glass-light hover:border-gold/20 transition-all"
              >
                <div className="w-7 h-7 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center">
                  <span className="text-xs font-heading font-bold text-gold">
                    {user.email[0].toUpperCase()}
                  </span>
                </div>
                <span className="text-sm text-cloud/80 font-body max-w-24 truncate">
                  {user.email.split('@')[0]}
                </span>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-runway transition-transform duration-200',
                    userMenuOpen && 'rotate-180',
                  )}
                />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 glass border border-sky-light/30 rounded-xl shadow-glass overflow-hidden animate-slide-down">
                  <div className="px-4 py-2 border-b border-sky-light/20">
                    <p className="text-xs text-runway">{user.email}</p>
                    <p className="text-xs font-heading text-gold tracking-wider uppercase mt-0.5">
                      {user.role}
                    </p>
                  </div>
                  <Link
                    to={isAdmin ? '/admin/bookings' : '/my-bookings'}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-cloud/80 hover:bg-sky-light/30 hover:text-cloud transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <Ticket className="w-4 h-4" />
                    {isAdmin ? 'All Bookings' : 'My Bookings'}
                  </Link>
                  {!isAdmin && (
                    <Link
                      to="/profile"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-cloud/80 hover:bg-sky-light/30 hover:text-cloud transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Settings className="w-4 h-4" />
                      My Profile
                    </Link>
                  )}
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-cloud/80 hover:bg-sky-light/30 hover:text-cloud transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Admin Dashboard
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-ember/80 hover:bg-ember/10 hover:text-ember transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn-ghost btn-sm">
                Sign In
              </Link>
              <Link to="/register" className="btn-primary btn-sm">
                Register
              </Link>
            </div>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden btn-icon text-cloud/80"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden glass border-t border-sky-light/20 mt-2 px-4 py-4 flex flex-col gap-3 animate-slide-down">
          <NavLink
            to="/search"
            className={({ isActive }) =>
              cn(
                'py-2 px-3 rounded-lg font-heading tracking-wider uppercase text-sm',
                isActive
                  ? 'text-gold bg-gold/10'
                  : 'text-cloud/80 hover:text-cloud hover:bg-sky-light/30',
              )
            }
            onClick={() => setMenuOpen(false)}
          >
            Flights
          </NavLink>
          {user && !isAdmin && (
            <NavLink
              to="/my-bookings"
              className={({ isActive }) =>
                cn(
                  'py-2 px-3 rounded-lg font-heading tracking-wider uppercase text-sm',
                  isActive
                    ? 'text-gold bg-gold/10'
                    : 'text-cloud/80 hover:text-cloud hover:bg-sky-light/30',
                )
              }
              onClick={() => setMenuOpen(false)}
            >
              My Bookings
            </NavLink>
          )}
          {user && !isAdmin && (
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                cn(
                  'py-2 px-3 rounded-lg font-heading tracking-wider uppercase text-sm',
                  isActive
                    ? 'text-gold bg-gold/10'
                    : 'text-cloud/80 hover:text-cloud hover:bg-sky-light/30',
                )
              }
              onClick={() => setMenuOpen(false)}
            >
              My Profile
            </NavLink>
          )}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                cn(
                  'py-2 px-3 rounded-lg font-heading tracking-wider uppercase text-sm',
                  isActive
                    ? 'text-gold bg-gold/10'
                    : 'text-cloud/80 hover:text-cloud hover:bg-sky-light/30',
                )
              }
              onClick={() => setMenuOpen(false)}
            >
              Admin
            </NavLink>
          )}
          <div className="pt-2 border-t border-sky-light/20 flex items-center gap-2">
            {user ? (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  handleLogout();
                }}
                className="btn-ghost btn-sm flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            ) : (
              <>
                <Link to="/login" className="btn-ghost btn-sm flex-1 text-center">
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="btn-primary btn-sm flex-1 text-center"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-sky-light/20 mt-20 py-12 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center">
                <Plane className="w-4 h-4 text-gold -rotate-45" />
              </div>
              <span className="font-heading text-lg font-bold tracking-widest uppercase text-cloud">
                Horizon <span className="font-display italic text-gold">Airways</span>
              </span>
            </div>
            <p className="text-sm text-runway max-w-sm font-display italic">
              Fly further, dream bigger. Where every journey begins with possibility.
            </p>
          </div>
          <div>
            <h4 className="font-heading text-xs tracking-widest uppercase text-runway mb-3">
              Navigate
            </h4>
            <ul className="space-y-2">
              {[
                { to: '/search', label: 'Search Flights' },
                { to: '/login', label: 'Sign In' },
                { to: '/register', label: 'Register' },
              ].map(l => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="text-sm text-runway/70 hover:text-cloud transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-heading text-xs tracking-widest uppercase text-runway mb-3">
              Support
            </h4>
            <ul className="space-y-2">
              {[
                { to: '/policy/contact', label: 'Contact Us' },
                { to: '/policy/baggage', label: 'Baggage Policy' },
                { to: '/policy/refund', label: 'Refund Policy' },
                { to: '/policy/privacy', label: 'Privacy' },
              ].map(l => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="text-sm text-runway/70 hover:text-cloud transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="gold-line mt-8 mb-6" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-runway/60 font-mono">
            © 2026 Horizon Airways. All rights reserved.
          </p>
          <p className="text-xs text-runway/40 font-heading tracking-widest uppercase">
            IATA · DGCA · BCAS Compliant
          </p>
        </div>
      </div>
    </footer>
  );
}
