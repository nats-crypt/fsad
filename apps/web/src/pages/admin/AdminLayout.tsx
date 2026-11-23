import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Plane,
  Users,
  Calendar,
  BarChart3,
  Clock,
  Zap,
  UserCheck,
  ChevronLeft,
  Menu,
  X,
  LogOut,
  Ticket,
  Radio,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/utils';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: BarChart3, end: true },
  { to: '/admin/live-map', label: 'Live Map', icon: Radio },
  { to: '/admin/aircraft', label: 'Aircraft', icon: Plane },
  { to: '/admin/employees', label: 'Employees', icon: Users },
  { to: '/admin/flights', label: 'Flights', icon: Calendar },
  { to: '/admin/bookings', label: 'Bookings', icon: Ticket },
  { to: '/admin/crew', label: 'Crew', icon: UserCheck },
  { to: '/admin/attendance', label: 'Attendance', icon: Clock },
  { to: '/admin/optimizer', label: 'AI Optimizer', icon: Zap },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen art-deco-bg flex">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 w-60 glass border-r border-sky-light/20 flex flex-col transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Logo */}
        <div className="p-4 border-b border-sky-light/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0">
              <Plane className="w-4 h-4 text-gold -rotate-45" />
            </div>
            <div>
              <p className="font-heading text-sm font-bold tracking-widest uppercase text-cloud">
                Horizon
              </p>
              <p className="font-heading text-xs text-gold tracking-widest">
                Operations
              </p>
            </div>
          </div>
        </div>

        {/* User info */}
        <div className="px-4 py-3 border-b border-sky-light/20">
          <p className="text-xs text-runway truncate">{user?.email}</p>
          <span className="badge badge-gold text-xs mt-1">{user?.role}</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn('admin-sidebar-link', isActive && 'active')
              }
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-sky-light/20 space-y-1">
          <NavLink
            to="/"
            className="admin-sidebar-link"
            onClick={() => setSidebarOpen(false)}
          >
            <ChevronLeft className="w-4 h-4" />
            Main Site
          </NavLink>
          <button
            onClick={handleLogout}
            className="admin-sidebar-link w-full text-ember/80 hover:text-ember hover:bg-ember/10"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-sky-darkest/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-60">
        {/* Top bar */}
        <header className="sticky top-0 z-10 glass border-b border-sky-light/20 px-4 sm:px-6 py-3 flex items-center gap-4 no-print">
          <button
            className="lg:hidden btn-icon text-runway hover:text-cloud"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <h1 className="font-heading text-sm font-semibold tracking-widest uppercase text-cloud">
            Admin Dashboard
          </h1>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 pb-16">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
