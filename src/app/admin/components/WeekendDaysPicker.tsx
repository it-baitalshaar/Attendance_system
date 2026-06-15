'use client';

import { WEEKDAY_OPTIONS } from '@/app/lib/overtimeCalendar';

interface WeekendDaysPickerProps {
  value: number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
}

export function WeekendDaysPicker({ value, onChange, disabled }: WeekendDaysPickerProps) {
  const toggle = (day: number) => {
    if (disabled) return;
    const set = new Set(value);
    if (set.has(day)) set.delete(day);
    else set.add(day);
    onChange(Array.from(set).sort((a, b) => a - b));
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Weekend days (weekend overtime ×1.5)</p>
      <div className="flex flex-wrap gap-2">
        {WEEKDAY_OPTIONS.map((d) => {
          const selected = value.includes(d.value);
          return (
            <button
              key={d.value}
              type="button"
              disabled={disabled}
              onClick={() => toggle(d.value)}
              className={`px-3 py-1.5 rounded border text-sm transition ${
                selected
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
              } disabled:opacity-50`}
            >
              {d.short}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-gray-500">
        Example: Construction → Sat; Maintenance → Sun. Selected days auto-default overtime to
        weekend rate.
      </p>
    </div>
  );
}
