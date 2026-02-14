/**
 * Status Badge Component
 * Displays decision status with icon, label, and color
 * Story 3.2: Implement Picks view with today's decisions list
 * 
 * Requirements:
 * - Icon + label + color (never color alone per NFR20)
 * - WCAG 2.2 AA contrast (NFR19)
 * - Semantic status indication
 */

import { STATUS_CONFIG, type DecisionStatus } from '../types';

interface StatusBadgeProps {
  status: DecisionStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5 gap-1',
  md: 'text-sm px-3 py-1 gap-1.5',
  lg: 'text-base px-4 py-1.5 gap-2',
};

export function StatusBadge({ status, size = 'md', className = '' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  
  return (
    <span
      role="status"
      aria-label={`Statut: ${config.label}`}
      className={`
        inline-flex items-center
        rounded-full font-medium
        border
        ${config.bgColor}
        ${config.borderColor}
        ${config.color}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      <span aria-hidden="true" className="flex-shrink-0">
        {config.icon}
      </span>
      <span>{config.label}</span>
    </span>
  );
}
