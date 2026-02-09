'use client';

import React from 'react';

interface DatePickerMaxTodayProps {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  className?: string;
}

const DatePickerMaxToday = ({ 
  value, 
  onChange, 
  label = "Select attendance date:",
  className = ""
}: DatePickerMaxTodayProps) => {
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto ${className}`}>
      <label className="text-black text-sm sm:text-base">{label}</label>
      <input
        type="date"
        className="text-black px-3 py-2.5 rounded-lg border w-full sm:w-auto min-h-[44px] touch-manipulation"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        max={today}
      />
    </div>
  );
};

export default DatePickerMaxToday;

