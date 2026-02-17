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

  const handlePreset = useCallback((days: number) => {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    
    onDateChange(
      fromDate.toISOString().split('T')[0],
      toDate.toISOString().split('T')[0]
    );
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
            onClick={() => handlePreset(7)}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            data-testid={testId ? `${testId}-preset-7d` : undefined}
          >
            7 jours
          </button>
          <button
            type="button"
            onClick={() => handlePreset(30)}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            data-testid={testId ? `${testId}-preset-30d` : undefined}
          >
            30 jours
          </button>
          <button
            type="button"
            onClick={() => handlePreset(90)}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            data-testid={testId ? `${testId}-preset-90d` : undefined}
          >
            90 jours
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
            max={new Date().toISOString().split('T')[0]}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            data-testid={testId ? `${testId}-to` : undefined}
          />
        </div>
      </div>
    </div>
  );
}

export default DateRangePicker;
