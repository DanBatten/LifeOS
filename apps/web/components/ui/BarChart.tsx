interface BarChartProps {
  data: number[];
  labels: string[];
  maxValue?: number;
  highlightIndex?: number;
  color?: 'green' | 'blue' | 'yellow' | 'gray';
  showValues?: boolean;
}

const colorClasses = {
  green: {
    bar: 'bg-green-600',
    highlight: 'bg-gray-900',
    label: 'text-green-800',
  },
  blue: {
    bar: 'bg-blue-500',
    highlight: 'bg-blue-700',
    label: 'text-blue-800',
  },
  yellow: {
    bar: 'bg-yellow-500',
    highlight: 'bg-yellow-700',
    label: 'text-yellow-800',
  },
  gray: {
    bar: 'bg-gray-400',
    highlight: 'bg-gray-700',
    label: 'text-gray-700',
  },
};

export function BarChart({
  data,
  labels,
  maxValue,
  highlightIndex,
  color = 'green',
  showValues = false,
}: BarChartProps) {
  const max = maxValue ?? Math.max(...data, 1);
  const colors = colorClasses[color];

  return (
    <div className="flex items-end justify-between gap-2 h-32">
      {data.map((value, index) => {
        const height = (value / max) * 100;
        const isHighlighted = index === highlightIndex;

        return (
          <div key={index} className="flex flex-col items-center flex-1">
            {/* Value label */}
            {showValues && value > 0 && (
              <span className="text-xs font-medium mb-1 opacity-70">
                {value.toFixed(1)}
              </span>
            )}

            {/* Bar */}
            <div className="w-full flex-1 flex items-end">
              <div
                className={`
                  w-full rounded-t-sm transition-all duration-300
                  ${isHighlighted ? colors.highlight : colors.bar}
                `}
                style={{ height: `${Math.max(height, 4)}%` }}
              />
            </div>

            {/* Label */}
            <span className={`text-xs mt-2 font-medium ${colors.label}`}>
              {labels[index]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface MiniBarChartProps {
  data: number[];
  color?: 'green' | 'blue' | 'yellow' | 'gray';
}

export function MiniBarChart({ data, color = 'green' }: MiniBarChartProps) {
  const max = Math.max(...data, 1);
  const colors = colorClasses[color];

  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((value, index) => {
        const height = (value / max) * 100;
        return (
          <div
            key={index}
            className={`w-1.5 rounded-t-sm ${colors.bar}`}
            style={{ height: `${Math.max(height, 10)}%` }}
          />
        );
      })}
    </div>
  );
}
