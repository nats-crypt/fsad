import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';
import { api } from '../lib/api';
import type { FareForecast } from '../types';
import { cn } from '../lib/utils';

interface FareBadgeProps {
  flightId: string;
  className?: string;
}

export default function FareBadge({ flightId, className }: FareBadgeProps) {
  const { data, isLoading } = useQuery<FareForecast>({
    queryKey: ['fare-forecast', flightId],
    queryFn: () => api.get<FareForecast>(`/ai/fare-forecast/${flightId}`),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className={cn('badge badge-gray animate-pulse', className)}>
        <Zap className="w-3 h-3" />
        <span>AI</span>
      </div>
    );
  }

  if (!data) return null;

  const icon = {
    RISING: <TrendingUp className="w-3 h-3" />,
    FALLING: <TrendingDown className="w-3 h-3" />,
    STEADY: <Minus className="w-3 h-3" />,
  }[data.trend];

  const badge = {
    BOOK_NOW: (
      <span
        className={cn(
          'badge bg-ember/15 text-ember border border-ember/30',
          className,
        )}
        title={`Fare is ${data.trend.toLowerCase()} — ${(data.confidence * 100).toFixed(0)}% confidence`}
      >
        {icon}
        Book Now
      </span>
    ),
    WAIT: (
      <span
        className={cn(
          'badge bg-jade/15 text-jade border border-jade/30',
          className,
        )}
        title={`Fare is ${data.trend.toLowerCase()} — ${(data.confidence * 100).toFixed(0)}% confidence`}
      >
        {icon}
        Price Dropping
      </span>
    ),
  }[data.advice];

  return badge ?? null;
}
