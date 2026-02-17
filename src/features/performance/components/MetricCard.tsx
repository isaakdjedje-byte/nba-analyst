/**
 * MetricCard Component
 * Story 4.1: Creer la vue Performance avec historique des recommandations
 * 
 * Displays a single metric with label, value, and tooltip
 * WCAG 2.2 AA compliant - includes text alternative to color
 */

interface MetricCardProps {
  label: string;
  value: number | string;
  suffix?: string;
  tooltip?: string;
  testId?: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

export function MetricCard({ 
  label, 
  value, 
  suffix, 
  tooltip, 
  testId,
  variant = 'default' 
}: MetricCardProps) {
  const variantStyles = {
    default: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  };

  const valueColorStyles = {
    default: 'text-gray-900 dark:text-white',
    success: 'text-green-700 dark:text-green-400',
    warning: 'text-yellow-700 dark:text-yellow-400',
    error: 'text-red-700 dark:text-red-400',
  };

  return (
    <div 
      className={`
        rounded-lg border p-4 flex flex-col gap-1
        ${variantStyles[variant]}
      `}
      data-testid={testId}
    >
      <div className="flex items-start justify-between gap-2">
        <span 
          className="text-sm font-medium text-gray-600 dark:text-gray-400"
          id={`${testId}-label`}
        >
          {label}
        </span>
        {tooltip && (
          <span 
            className="text-gray-400 dark:text-gray-500 cursor-help"
            data-testid={testId ? `${testId}-tooltip` : undefined}
            title={tooltip}
            aria-label={`${label}: ${tooltip}`}
            role="img"
          >
            ⓘ
          </span>
        )}
      </div>
      <div 
        className={`text-3xl font-bold ${valueColorStyles[variant]}`}
        aria-labelledby={`${testId}-label`}
        data-testid={testId ? `${testId}-value` : undefined}
      >
        {value}{suffix && <span className="text-lg font-normal ml-1">{suffix}</span>}
      </div>
    </div>
  );
}

export default MetricCard;
