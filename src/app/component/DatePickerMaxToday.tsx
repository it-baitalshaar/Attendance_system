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
    <div className={`flex items-center gap-3 ${className}`}>
      <label className="text-black">{label}</label>
      <input
        type="date"
        className="text-black px-3 py-2 rounded-lg border"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        max={today}
      />
    </div>
  );
};

export default DatePickerMaxToday;

