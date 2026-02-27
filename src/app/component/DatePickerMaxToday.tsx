'use client';

import React from 'react';

interface DatePickerMaxTodayProps {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  className?: string;
  /** When > 0, allows selecting dates up to this many days in the future. */
  allowFutureDays?: number;
}

const DatePickerMaxToday = ({
  value,
  onChange,
  label = 'Select attendance date:',
  className = '',
  allowFutureDays = 0,
}: DatePickerMaxTodayProps) => {
  const today = new Date().toISOString().split('T')[0];

  let maxDate = today;
  if (allowFutureDays && allowFutureDays > 0) {
    const base = new Date(`${today}T00:00:00Z`);
    const future = new Date(base);
    future.setUTCDate(base.getUTCDate() + allowFutureDays);
    maxDate = future.toISOString().split('T')[0];
  }

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto ${className}`}>
      <label className="text-black text-sm sm:text-base">{label}</label>
      <input
        type="date"
        className="text-black px-3 py-2.5 rounded-lg border w-full sm:w-auto min-h-[44px] touch-manipulation"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        max={maxDate}
      />
    </div>
  );
};

export default DatePickerMaxToday;


