import Link from 'next/link';
import { ReactNode } from 'react';

export type ModuleColor = 'lime' | 'dark' | 'light' | 'white' | 'amber';
export type ModuleSize = 'sm' | 'md' | 'lg';

interface ModuleCardProps {
  color: ModuleColor;
  title?: string;
  children: ReactNode;
  href?: string;
  size?: ModuleSize;
  className?: string;
  showPattern?: boolean;
  actionButton?: boolean;
}

const colorClasses: Record<ModuleColor, string> = {
  lime: 'bg-[#D4E157] text-gray-900',
  dark: 'bg-[#1a1a1a] text-white',
  light: 'bg-[#f5f5f5] text-gray-900',
  white: 'bg-white text-gray-900 shadow-sm',
  amber: 'bg-amber-100 text-gray-900',
};

const patternColors: Record<ModuleColor, string> = {
  lime: 'stroke-[#c4d147]/40',
  dark: 'stroke-gray-700/50',
  light: 'stroke-gray-300/50',
  white: 'stroke-gray-200/50',
  amber: 'stroke-amber-300/40',
};

// Decorative arc pattern SVG
function ArcPattern({ color }: { color: ModuleColor }) {
  return (
    <svg
      className="absolute right-0 top-0 h-full w-1/2 pointer-events-none"
      viewBox="0 0 200 300"
      fill="none"
      preserveAspectRatio="xMaxYMid slice"
    >
      <circle
        cx="250"
        cy="150"
        r="60"
        className={patternColors[color]}
        strokeWidth="1"
        fill="none"
      />
      <circle
        cx="250"
        cy="150"
        r="90"
        className={patternColors[color]}
        strokeWidth="1"
        fill="none"
      />
      <circle
        cx="250"
        cy="150"
        r="120"
        className={patternColors[color]}
        strokeWidth="1"
        fill="none"
      />
      <circle
        cx="250"
        cy="150"
        r="150"
        className={patternColors[color]}
        strokeWidth="1"
        fill="none"
      />
      <circle
        cx="250"
        cy="150"
        r="180"
        className={patternColors[color]}
        strokeWidth="1"
        fill="none"
      />
    </svg>
  );
}

export function ModuleCard({
  color,
  title,
  children,
  href,
  size = 'md',
  className = '',
  showPattern = true,
  actionButton = false,
}: ModuleCardProps) {
  const sizeClasses = {
    sm: 'p-4 rounded-2xl',
    md: 'p-6 rounded-3xl',
    lg: 'p-8 rounded-3xl',
  };

  const content = (
    <div
      className={`
        relative overflow-hidden
        transition-all duration-300
        ${href ? 'hover:scale-[1.02] cursor-pointer' : ''}
        ${colorClasses[color]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {/* Decorative pattern */}
      {showPattern && <ArcPattern color={color} />}

      {/* Content */}
      <div className="relative z-10">
        {title && (
          <h3 className={`text-lg font-semibold mb-4 ${color === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {title}
          </h3>
        )}
        {children}
      </div>

      {/* Action button */}
      {actionButton && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-20">
          <div className={`
            w-12 h-12 rounded-full flex items-center justify-center
            shadow-lg transition-transform hover:scale-110
            ${color === 'lime' ? 'bg-[#1a1a1a] text-white' : 'bg-white text-gray-900'}
          `}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href} className="block">{content}</Link>;
  }

  return content;
}

// Mini card component for small stats
interface MiniCardProps {
  title: string;
  value: string | number;
  sublabel?: string;
  href?: string;
}

export function MiniCard({ title, value, sublabel, href }: MiniCardProps) {
  const content = (
    <div className="bg-[#f5f5f5] rounded-2xl p-4 flex-1 min-w-[140px]">
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm font-medium text-gray-600 leading-tight">
          {title}
        </span>
        <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center flex-shrink-0">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-400">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {sublabel && (
          <span className="text-sm text-gray-500">{sublabel}</span>
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} className="block flex-1">{content}</Link>;
  }

  return content;
}

// Card stack for overlapping effect
interface CardStackProps {
  children: ReactNode;
  className?: string;
}

export function CardStack({ children, className = '' }: CardStackProps) {
  return (
    <div className={`relative space-y-[-20px] ${className}`}>
      {children}
    </div>
  );
}
