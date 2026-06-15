'use client';

import { useOptionalOvertimeCalendarContext } from '@/app/context/OvertimeCalendarContext';
import type { DepartmentTheme } from '@/app/constants/themes';

interface HomeCalendarDayBannerProps {
  theme?: DepartmentTheme;
}

export function HomeCalendarDayBanner({ theme }: HomeCalendarDayBannerProps) {
  const calendar = useOptionalOvertimeCalendarContext();
  const isSaqiya = theme?.id === 'saqiya';

  if (!calendar || calendar.loading) return null;

  const { holidayNameForDate, suggestedAttendanceStatus } = calendar;

  if (holidayNameForDate) {
    return (
      <div
        className={`mt-3 w-full max-w-2xl mx-auto px-3 py-3 rounded-lg border text-sm sm:text-base ${
          isSaqiya
            ? 'bg-amber-50 border-amber-300 text-amber-950'
            : 'bg-amber-50 border-amber-300 text-amber-950'
        }`}
        role="status"
      >
        <p className="font-medium">
          Public holiday: <span className="font-semibold">{holidayNameForDate}</span>
        </p>
        <p className={`text-xs sm:text-sm mt-1 ${isSaqiya ? 'text-amber-900/90' : 'text-amber-900/90'}`}>
          Holiday attendance and holiday overtime (×2.5) are selected by default for this date.
        </p>
      </div>
    );
  }

  if (suggestedAttendanceStatus === 'Weekend') {
    return (
      <div
        className={`mt-3 w-full max-w-2xl mx-auto px-3 py-3 rounded-lg border text-sm sm:text-base ${
          isSaqiya
            ? 'bg-blue-50 border-blue-200 text-blue-950'
            : 'bg-blue-50 border-blue-200 text-blue-950'
        }`}
        role="status"
      >
        <p className="font-medium">Weekend for this department</p>
        <p className={`text-xs sm:text-sm mt-1 ${isSaqiya ? 'text-blue-900/90' : 'text-blue-900/90'}`}>
          Weekend attendance and weekend overtime (×1.5) are selected by default for this date.
        </p>
      </div>
    );
  }

  return null;
}
