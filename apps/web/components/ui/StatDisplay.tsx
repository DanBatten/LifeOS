import { ReactNode } from 'react';

interface StatDisplayProps {
  value: string | number;
  prefix?: string;
  label?: string;
  comparison?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  dark?: boolean;
}

const sizeClasses = {
  sm: {
    value: 'text-2xl',
    prefix: 'text-lg',
    label: 'text-xs',
    comparison: 'text-xs',
  },
  md: {
    value: 'text-3xl',
    prefix: 'text-xl',
    label: 'text-sm',
    comparison: 'text-sm',
  },
  lg: {
    value: 'text-4xl',
    prefix: 'text-2xl',
    label: 'text-base',
    comparison: 'text-sm',
  },
  xl: {
    value: 'text-5xl',
    prefix: 'text-3xl',
    label: 'text-lg',
    comparison: 'text-base',
  },
};

export function StatDisplay({
  value,
  prefix,
  label,
  comparison,
  size = 'lg',
  dark = false,
}: StatDisplayProps) {
  const classes = sizeClasses[size];
  const textColor = dark ? 'text-white' : 'text-gray-900';
  const mutedColor = dark ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className="flex flex-col">
      {/* Main stat */}
      <div className="flex items-baseline gap-0.5">
        {prefix && (
          <span className={`font-medium ${mutedColor} ${classes.prefix}`}>
            {prefix}
          </span>
        )}
        <span className={`font-bold tracking-tight ${textColor} ${classes.value}`}>
          {value}
        </span>
      </div>

      {/* Label */}
      {label && (
        <span className={`font-medium mt-1 ${mutedColor} ${classes.label}`}>
          {label}
        </span>
      )}

      {/* Comparison text */}
      {comparison && (
        <p className={`mt-2 ${mutedColor} ${classes.comparison} leading-tight`}>
          {comparison}
        </p>
      )}
    </div>
  );
}

// Compact stat for grids
interface CompactStatProps {
  value: string | number;
  unit?: string;
  label: string;
  dark?: boolean;
}

export function CompactStat({ value, unit, label, dark = false }: CompactStatProps) {
  const textColor = dark ? 'text-white' : 'text-gray-900';
  const mutedColor = dark ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className="text-center">
      <div className="flex items-baseline justify-center gap-0.5">
        <span className={`text-2xl font-bold ${textColor}`}>{value}</span>
        {unit && <span className={`text-sm ${mutedColor}`}>{unit}</span>}
      </div>
      <span className={`text-xs ${mutedColor}`}>{label}</span>
    </div>
  );
}

// Stat row for horizontal layouts
interface StatRowProps {
  children: ReactNode;
  className?: string;
}

export function StatRow({ children, className = '' }: StatRowProps) {
  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      {children}
    </div>
  );
}

// Metric with icon
interface MetricProps {
  icon?: ReactNode;
  value: string | number;
  label: string;
  trend?: 'up' | 'down';
  dark?: boolean;
}

export function Metric({ icon, value, label, trend, dark = false }: MetricProps) {
  const textColor = dark ? 'text-white' : 'text-gray-900';
  const mutedColor = dark ? 'text-gray-400' : 'text-gray-500';
  const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : '';

  return (
    <div className="flex items-center gap-3">
      {icon && (
        <div className={`w-10 h-10 rounded-xl ${dark ? 'bg-white/10' : 'bg-gray-100'} flex items-center justify-center`}>
          {icon}
        </div>
      )}
      <div>
        <div className="flex items-baseline gap-1">
          <span className={`text-xl font-bold ${textColor}`}>{value}</span>
          {trend && (
            <svg className={`w-4 h-4 ${trendColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={trend === 'up' ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'}
              />
            </svg>
          )}
        </div>
        <span className={`text-sm ${mutedColor}`}>{label}</span>
      </div>
    </div>
  );
}
