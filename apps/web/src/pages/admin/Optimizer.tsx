import { useQuery } from '@tanstack/react-query';
import { Zap, Loader2, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { api } from '../../lib/api';
import type { OptimizerResult } from '../../types';
import { cn, getLoadFactorColor, getFlagColor } from '../../lib/utils';

export default function Optimizer() {
  const { data, isLoading, isError, refetch } = useQuery<OptimizerResult[]>({
    queryKey: ['optimizer'],
    queryFn: () => api.get<OptimizerResult[]>('/ai/optimizer'),
    staleTime: 2 * 60 * 1000,
  });

  const FlagIcon = ({ flag }: { flag: 'OVER' | 'UNDER' | 'OK' }) => {
    if (flag === 'OVER') return <TrendingUp className="w-4 h-4" />;
    if (flag === 'UNDER') return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-heading tracking-widest uppercase text-gold mb-1">
            AI Operations
          </p>
          <h1 className="section-title flex items-center gap-2">
            <Zap className="w-7 h-7 text-gold" />
            Demand & Crew Optimizer
          </h1>
        </div>
        <button className="btn-secondary btn-sm" onClick={() => refetch()}>
          Refresh
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {[
          { flag: 'OVER' as const, label: 'Overstaffed / High Demand', desc: 'Recommend reducing crew or upselling' },
          { flag: 'UNDER' as const, label: 'Understaffed / Low Demand', desc: 'Recommend adding crew or promotion' },
          { flag: 'OK' as const, label: 'Balanced', desc: 'Optimal staffing and demand' },
        ].map(item => (
          <div
            key={item.flag}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs',
              getFlagColor(item.flag),
            )}
          >
            <FlagIcon flag={item.flag} />
            <div>
              <p className="font-heading font-semibold">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-3 py-16 card">
          <Loader2 className="w-8 h-8 text-gold animate-spin" />
          <span className="text-runway font-heading tracking-widest">
            AI analyzing flights…
          </span>
        </div>
      )}

      {isError && (
        <div className="card border border-ember/30 p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-ember flex-shrink-0" />
          <p className="text-runway">Failed to load optimizer data.</p>
        </div>
      )}

      {!isLoading && !isError && data && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sky-light/20">
                  {['Flight', 'Load Factor', 'Rec. Crew', 'Flag', 'AI Rationale'].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-heading tracking-widest uppercase text-runway"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map(item => (
                  <tr
                    key={item.flightId}
                    className="border-b border-sky-light/10 hover:bg-sky-light/10 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-gold font-semibold">
                        {item.flightNo}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="progress-bar w-20">
                          <div
                            className="progress-fill"
                            style={{ width: `${item.predictedLoadFactor * 100}%` }}
                          />
                        </div>
                        <span
                          className={cn(
                            'text-xs font-mono font-semibold',
                            getLoadFactorColor(item.predictedLoadFactor),
                          )}
                        >
                          {(item.predictedLoadFactor * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-cloud">
                        {item.recommendedCrew}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'badge text-xs flex items-center gap-1 w-fit',
                          getFlagColor(item.flag),
                        )}
                      >
                        <FlagIcon flag={item.flag} />
                        {item.flag}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-runway max-w-xs">
                      <p className="text-xs leading-relaxed line-clamp-2">
                        {item.rationale}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.length === 0 && (
            <div className="text-center py-12 text-runway font-heading tracking-wide">
              No flights to optimize
            </div>
          )}

          <div className="px-4 py-3 border-t border-sky-light/20 flex items-center justify-between">
            <p className="text-xs text-runway">
              {data.length} flight{data.length !== 1 ? 's' : ''} analyzed
            </p>
            <p className="text-xs text-runway/50 flex items-center gap-1">
              <Zap className="w-3 h-3 text-gold" />
              Powered by Horizon AI
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
