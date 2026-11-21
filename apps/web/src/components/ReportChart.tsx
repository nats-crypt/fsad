import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { ReportSeries } from '../types';
import { cn } from '../lib/utils';

interface ReportChartProps {
  series: ReportSeries[];
  type?: 'bar' | 'line' | 'area';
  title?: string;
  valuePrefix?: string;
  className?: string;
  height?: number;
}

const COLORS = {
  primary: '#C9A040',
  secondary: '#2E86C1',
  grid: 'rgba(139,155,180,0.15)',
  text: '#8B9BB4',
};

const customTooltipStyle = {
  backgroundColor: '#0D1F38',
  border: '1px solid rgba(139,155,180,0.3)',
  borderRadius: '8px',
  padding: '8px 12px',
  fontFamily: '"Plus Jakarta Sans", system-ui',
  fontSize: '12px',
  color: '#F0F4F8',
};

export default function ReportChart({
  series,
  type = 'bar',
  title,
  valuePrefix = '',
  className,
  height = 280,
}: ReportChartProps) {
  if (!series.length) {
    return (
      <div
        className={cn(
          'card flex items-center justify-center',
          className,
        )}
        style={{ height }}
      >
        <p className="text-runway font-heading tracking-wide">No data</p>
      </div>
    );
  }

  const data = series.map(s => ({ name: s.label, value: s.value }));

  return (
    <div className={cn('card p-4', className)}>
      {title && (
        <p className="font-heading text-sm tracking-widest uppercase text-runway mb-4">
          {title}
        </p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        {type === 'bar' ? (
          <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: COLORS.text, fontSize: 11, fontFamily: 'JetBrains Mono' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: COLORS.text, fontSize: 11, fontFamily: 'JetBrains Mono' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `${valuePrefix}${v}`}
            />
            <Tooltip
              contentStyle={customTooltipStyle}
              cursor={{ fill: 'rgba(201,160,64,0.05)' }}
              formatter={(v: number) => [`${valuePrefix}${v}`, 'Value']}
            />
            <Bar
              dataKey="value"
              fill={COLORS.primary}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
          </BarChart>
        ) : type === 'line' ? (
          <LineChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: COLORS.text, fontSize: 11, fontFamily: 'JetBrains Mono' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: COLORS.text, fontSize: 11, fontFamily: 'JetBrains Mono' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `${valuePrefix}${v}`}
            />
            <Tooltip
              contentStyle={customTooltipStyle}
              formatter={(v: number) => [`${valuePrefix}${v}`, 'Value']}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={COLORS.primary}
              strokeWidth={2}
              dot={{ fill: COLORS.primary, strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, fill: COLORS.secondary }}
            />
          </LineChart>
        ) : (
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: COLORS.text, fontSize: 11, fontFamily: 'JetBrains Mono' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: COLORS.text, fontSize: 11, fontFamily: 'JetBrains Mono' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `${valuePrefix}${v}`}
            />
            <Tooltip
              contentStyle={customTooltipStyle}
              formatter={(v: number) => [`${valuePrefix}${v}`, 'Value']}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={COLORS.primary}
              strokeWidth={2}
              fill="url(#areaGradient)"
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
