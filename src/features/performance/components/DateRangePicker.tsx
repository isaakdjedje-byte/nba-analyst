/**
 * DateRangePicker Component
 * Story 4.1: Creer la vue Performance avec historique des recommandations
 * 
 * Allows users to select a date range for filtering metrics
 * WCAG 2.2 AA compliant - keyboard accessible
 */

'use client';

import { useCallback } from 'react';
import { Calendar } from 'lucide-react';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getStartOfCurrentWeek(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diffToMonday = (day + 6) % 7;
  copy.setDate(copy.getDate() - diffToMonday);
  return copy;
}

function getStartOfCurrentMonth(date: Date): Date {
  const copy = new Date(date);
  copy.setDate(1);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getEndOfNextThreeMonths(date: Date): Date {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + 3, 0);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function getStartOfLastThreeMonths(date: Date): Date {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() - 3);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

interface DateRangePickerProps {
  fromDate: string;
  toDate: string;
  onDateChange: (fromDate: string, toDate: string) => void;
  testId?: string;
}

export function DateRangePicker({ 
  fromDate, 
  toDate, 
  onDateChange,
  testId 
}: DateRangePickerProps) {
  const handleFromDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newFromDate = e.target.value;
    onDateChange(newFromDate, toDate);
  }, [onDateChange, toDate]);

  const handleToDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newToDate = e.target.value;
    onDateChange(fromDate, newToDate);
  }, [onDateChange, fromDate]);

  const handlePreset = useCallback((preset: 'week' | 'month' | 'next-3-months' | 'last-3-months') => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    if (preset === 'week') {
      onDateChange(formatLocalDate(getStartOfCurrentWeek(now)), formatLocalDate(now));
      return;
    }

    if (preset === 'month') {
      onDateChange(formatLocalDate(getStartOfCurrentMonth(now)), formatLocalDate(now));
      return;
    }

    if (preset === 'last-3-months') {
      onDateChange(formatLocalDate(getStartOfLastThreeMonths(now)), formatLocalDate(now));
      return;
    }

    onDateChange(formatLocalDate(getStartOfCurrentMonth(now)), formatLocalDate(getEndOfNextThreeMonths(now)));
  }, [onDateChange]);

  return (
    <div 
      className="flex flex-col sm:flex-row gap-3 items-start sm:items-center"
      data-testid={testId}
    >
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Période:
        </span>
      </div>
      
      <div className="flex flex-wrap gap-2 items-center">
        {/* Quick presets */}
        <div className="flex gap-1" role="group" aria-label="Preselection de période rapide">
          <button
            type="button"
            onClick={() => handlePreset('week')}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            data-testid={testId ? `${testId}-preset-7d` : undefined}
          >
            Semaine actuelle
          </button>
          <button
            type="button"
            onClick={() => handlePreset('month')}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            data-testid={testId ? `${testId}-preset-30d` : undefined}
          >
            Mois actuel
          </button>
          <button
            type="button"
            onClick={() => handlePreset('last-3-months')}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            data-testid={testId ? `${testId}-preset-last-3m` : undefined}
          >
            3 derniers mois
          </button>
          <button
            type="button"
            onClick={() => handlePreset('next-3-months')}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            data-testid={testId ? `${testId}-preset-90d` : undefined}
          >
            3 prochains mois
          </button>
        </div>

        {/* Custom date inputs */}
        <div className="flex gap-2 items-center">
          <label className="sr-only" htmlFor={`${testId}-from`}>
            Date de début
          </label>
          <input
            id={`${testId}-from`}
            type="date"
            value={fromDate}
            onChange={handleFromDateChange}
            max={toDate}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            data-testid={testId ? `${testId}-from` : undefined}
          />
          <span className="text-gray-500 dark:text-gray-400" aria-hidden="true">→</span>
          <label className="sr-only" htmlFor={`${testId}-to`}>
            Date de fin
          </label>
          <input
            id={`${testId}-to`}
            type="date"
            value={toDate}
            onChange={handleToDateChange}
            min={fromDate}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            data-testid={testId ? `${testId}-to` : undefined}
          />
        </div>
      </div>
    </div>
  );
}

export default DateRangePicker;
