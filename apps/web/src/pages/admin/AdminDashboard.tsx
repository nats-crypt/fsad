import { useQuery } from '@tanstack/react-query';
import { Plane, Users, Calendar, BarChart3, Zap, TrendingUp } from 'lucide-react';
import { api } from '../../lib/api';
import { Link } from 'react-router-dom';

interface DashStat {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  to: string;
  color: string;
}

export default function AdminDashboard() {
  const { data: aircraft } = useQuery({
    queryKey: ['admin-aircraft'],
    queryFn: () => api.get<{ id: string }[]>('/aircraft'),
  });

  const { data: employees } = useQuery({
    queryKey: ['admin-employees'],
    queryFn: () => api.get<{ id: string }[]>('/employees'),
  });

  const { data: optimizer } = useQuery({
    queryKey: ['optimizer'],
    queryFn: () =>
      api.get<{ flightId: string; flag: string }[]>('/ai/optimizer'),
    retry: false,
  });

  const stats: DashStat[] = [
    {
      label: 'Aircraft in Fleet',
      value: aircraft?.length ?? '—',
      icon: <Plane className="w-5 h-5" />,
      to: '/admin/aircraft',
      color: 'text-gold',
    },
    {
      label: 'Employees',
      value: employees?.length ?? '—',
      icon: <Users className="w-5 h-5" />,
      to: '/admin/employees',
      color: 'text-horizon-bright',
    },
    {
      label: 'Flagged Flights',
      value:
        optimizer?.filter(o => o.flag !== 'OK').length ?? '—',
      icon: <Zap className="w-5 h-5" />,
      to: '/admin/optimizer',
      color: 'text-ember',
    },
    {
      label: 'AI Optimizations',
      value: optimizer?.length ?? '—',
      icon: <BarChart3 className="w-5 h-5" />,
      to: '/admin/reports',
      color: 'text-jade',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-heading tracking-widest uppercase text-gold mb-1">
          Operations Center
        </p>
        <h1 className="section-title">Dashboard</h1>
        <div className="gold-line-left w-24 mt-2" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-reveal">
        {stats.map(stat => (
          <Link
            key={stat.label}
            to={stat.to}
            className="stat-card card-hover group"
          >
            <div className={`${stat.color} mb-2`}>{stat.icon}</div>
            <p className="text-3xl font-heading font-bold text-cloud">
              {stat.value}
            </p>
            <p className="text-xs text-runway font-heading tracking-wide uppercase">
              {stat.label}
            </p>
          </Link>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card border border-sky-light/30 p-5">
          <h2 className="font-heading text-lg font-semibold text-cloud mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gold" />
            Quick Actions
          </h2>
          <div className="space-y-2">
            {[
              { to: '/admin/flights', label: 'Schedule a Flight', icon: Plane },
              { to: '/admin/crew', label: 'Assign Crew', icon: Users },
              { to: '/admin/attendance', label: 'Mark Attendance', icon: Calendar },
              { to: '/admin/optimizer', label: 'View AI Recommendations', icon: Zap },
            ].map(item => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-sky-light/20 transition-colors group"
              >
                <item.icon className="w-4 h-4 text-runway group-hover:text-gold transition-colors" />
                <span className="text-sm text-runway group-hover:text-cloud transition-colors">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="card border border-sky-light/30 p-5">
          <h2 className="font-heading text-lg font-semibold text-cloud mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gold" />
            Reports
          </h2>
          <div className="space-y-2">
            {[
              'Revenue',
              'Flights',
              'Reservations',
              'Cancellations',
              'Attendance',
              'Performance',
            ].map(type => (
              <Link
                key={type}
                to={`/admin/reports?type=${type.toLowerCase()}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-sky-light/20 transition-colors group"
              >
                <BarChart3 className="w-4 h-4 text-runway group-hover:text-gold transition-colors" />
                <span className="text-sm text-runway group-hover:text-cloud transition-colors">
                  {type} Report
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
