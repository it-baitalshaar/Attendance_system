'use client';

import React from 'react';

interface DatePickerMinTodayProps {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  className?: string;
}

const DatePickerMinToday = ({ 
  value, 
  onChange, 
  label = "Select date (from today onwards):",
  className = ""
}: DatePickerMinTodayProps) => {
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <label className="text-black">{label}</label>
      <input
        type="date"
        className="text-black px-3 py-2 rounded-lg border"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={today}
      />
    </div>
  );
};

export default DatePickerMinToday;

