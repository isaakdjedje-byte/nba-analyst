'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface DecisionDateFilterProps {
  testId?: string;
  statuses?: Array<'PICK' | 'NO_BET' | 'HARD_STOP'>;
}

const MONTH_LABELS = [
  'Janvier',
  'Fevrier',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Aout',
  'Septembre',
  'Octobre',
  'Novembre',
  'Decembre',
] as const;

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getMonthCalendarDays(viewDate: Date): Array<Date | null> {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday-first

  const days: Array<Date | null> = [];

  for (let i = 0; i < startOffset; i += 1) {
    days.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(new Date(year, month, day));
  }

  while (days.length < 42) {
    days.push(null);
  }

  return days;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function chunkIntoWeeks(days: Array<Date | null>): Array<Array<Date | null>> {
  const weeks: Array<Array<Date | null>> = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

interface CalendarSummaryRow {
  date: string;
  total: number;
  pick: number;
  noBet: number;
  hardStop: number;
}

export function DecisionDateFilter({
  testId = 'decision-date-filter',
  statuses,
}: DecisionDateFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedDate = useMemo(() => searchParams.get('date') || '', [searchParams]);
  const selectedDateObject = useMemo(() => parseIsoDate(selectedDate), [selectedDate]);
  const statusesKey = useMemo(() => (statuses && statuses.length > 0 ? statuses.join(',') : ''), [statuses]);
  const [viewMonth, setViewMonth] = useState<number>((selectedDateObject ?? new Date()).getMonth());
  const [viewYear, setViewYear] = useState<number>((selectedDateObject ?? new Date()).getFullYear());

  useEffect(() => {
    const sourceDate = selectedDateObject ?? new Date();
    setViewMonth(sourceDate.getMonth());
    setViewYear(sourceDate.getFullYear());
  }, [selectedDateObject]);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let year = currentYear - 10; year <= currentYear + 10; year += 1) {
      years.push(year);
    }
    return years;
  }, []);

  const calendarDays = useMemo(() => getMonthCalendarDays(new Date(viewYear, viewMonth, 1)), [viewMonth, viewYear]);
  const calendarWeeks = useMemo(() => chunkIntoWeeks(calendarDays), [calendarDays]);
  const [summaryMap, setSummaryMap] = useState<Record<string, CalendarSummaryRow>>({});

  useEffect(() => {
    let mounted = true;

    const loadSummary = async () => {
      const month = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
      const params = new URLSearchParams({ month });
      if (statusesKey) {
        params.set('statuses', statusesKey);
      }

      try {
        const response = await fetch(`/api/v1/decisions/calendar-summary?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!response.ok) {
          if (mounted) setSummaryMap({});
          return;
        }

        const payload = await response.json();
        const rows = Array.isArray(payload?.data) ? (payload.data as CalendarSummaryRow[]) : [];
        const map: Record<string, CalendarSummaryRow> = {};
        for (const row of rows) {
          map[row.date] = row;
        }

        if (mounted) {
          setSummaryMap(map);
        }
      } catch {
        if (mounted) {
          setSummaryMap({});
        }
      }
    };

    void loadSummary();

    return () => {
      mounted = false;
    };
  }, [viewMonth, viewYear, statusesKey]);

  const updateDate = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('date', value);
    } else {
      params.delete('date');
    }

    const query = params.toString();
    router.push(query ? `?${query}` : '?', { scroll: false });
  };

  const shiftMonth = (direction: -1 | 1) => {
    const next = new Date(viewYear, viewMonth + direction, 1);
    setViewMonth(next.getMonth());
    setViewYear(next.getFullYear());
  };

  const selectDay = (date: Date) => {
    updateDate(formatLocalDate(date));
  };

  return (
    <div className="mb-6 ml-auto w-full max-w-md rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-[0_8px_30px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/80">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">Calendrier des matchs</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Clique un jour pour filtrer Picks/No-Bet sur cette date.
          </p>
        </div>
        {selectedDate && (
          <button
            type="button"
            onClick={() => updateDate('')}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
            data-testid={`${testId}-reset`}
          >
            Reinitialiser
          </button>
        )}
      </div>

      <div className="mx-auto max-w-md rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-slate-700 dark:bg-slate-900/95">
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="h-10 w-10 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            data-testid={`${testId}-prev-month`}
            aria-label="Mois precedent"
          >
            {'<'}
          </button>

            <select
              value={viewMonth}
              onChange={(event) => setViewMonth(Number.parseInt(event.target.value, 10))}
            className="h-10 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            data-testid={`${testId}-month-select`}
          >
            {MONTH_LABELS.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={viewYear}
            onChange={(event) => setViewYear(Number.parseInt(event.target.value, 10))}
            className="h-10 w-24 rounded-xl border border-slate-300 bg-white px-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            data-testid={`${testId}-year-select`}
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="h-10 w-10 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            data-testid={`${testId}-next-month`}
            aria-label="Mois suivant"
          >
            {'>'}
          </button>
        </div>

        <div className="mt-1 overflow-x-auto" data-testid={`${testId}-calendar-grid`}>
          <table className="w-full min-w-[560px] table-fixed border-separate border-spacing-1.5">
            <thead>
              <tr>
                {WEEKDAY_LABELS.map((dayLabel) => (
                  <th
                    key={dayLabel}
                    className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                  >
                    {dayLabel}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calendarWeeks.map((week, weekIndex) => (
                <tr key={`week-${weekIndex}`}>
                  {week.map((day, dayIndex) => {
                    if (!day) {
                      return (
                        <td
                          key={`empty-${weekIndex}-${dayIndex}`}
                          className="h-20 rounded-2xl border border-transparent bg-slate-50/60 dark:bg-slate-800/40"
                          aria-hidden="true"
                        />
                      );
                    }

                    const isSelected = selectedDateObject ? isSameDay(day, selectedDateObject) : false;
                    const isToday = isSameDay(day, new Date());
                    const dayKey = formatLocalDate(day);
                    const summary = summaryMap[dayKey];

                    return (
                      <td key={day.toISOString()} className="h-20 align-top">
                        <button
                          type="button"
                          onClick={() => selectDay(day)}
                          className={[
                            'h-full w-full rounded-2xl border p-2 text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-sky-500',
                            isSelected
                              ? 'border-sky-600 bg-sky-600 text-white shadow-[0_10px_22px_rgba(2,132,199,0.35)]'
                              : isToday
                              ? 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-500/60 dark:bg-sky-900/25 dark:text-sky-200 dark:hover:bg-sky-900/35'
                              : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
                          ].join(' ')}
                          data-testid={`${testId}-day-${formatLocalDate(day)}`}
                          aria-pressed={isSelected}
                        >
                          <div className="flex h-full flex-col">
                            <span className="text-sm font-semibold leading-tight">{day.getDate()}</span>
                            <span
                              className={[
                                'mt-auto text-[10px] leading-tight truncate',
                                isSelected ? 'text-sky-100' : 'text-slate-500 dark:text-slate-400',
                              ].join(' ')}
                            >
                              {summary ? `${summary.total} pred.` : ''}
                            </span>
                          </div>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
