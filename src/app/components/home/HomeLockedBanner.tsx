import type { DepartmentTheme } from '@/app/constants/themes';

interface HomeLockedBannerProps {
  existingSubmission: unknown;
  cardsLocked: boolean;
  onEditAttendance: () => void;
  onOpenReport: () => void;
  selectedDepartment: string;
  onOpenReportOnly: () => void;
  theme?: DepartmentTheme;
}

export function HomeLockedBanner({
  existingSubmission,
  cardsLocked,
  onEditAttendance,
  onOpenReport,
  selectedDepartment,
  onOpenReportOnly,
  theme,
}: HomeLockedBannerProps) {
  const isSaqiya = theme?.id === 'saqiya';
  const btnBase = 'px-3 py-2.5 min-h-[44px] rounded-theme-card touch-manipulation font-medium';
  const btnPrimary = isSaqiya ? 'bg-theme-primary text-theme-white hover:opacity-90' : 'bg-blue-600 text-white hover:bg-blue-700';
  const btnSecondary = isSaqiya ? 'bg-theme-accent text-theme-white hover:opacity-90' : 'bg-amber-600 text-white hover:bg-amber-700';

  if (existingSubmission && cardsLocked) {
    return (
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
        <span className={`font-medium text-sm sm:text-base text-center sm:text-left ${isSaqiya ? 'text-theme-accent' : 'text-amber-700'}`}>
          Attendance already submitted for this date and department.
        </span>
        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
          <button type="button" onClick={onEditAttendance} className={`${btnBase} ${btnSecondary}`}>
            Edit Attendance
          </button>
          <button type="button" onClick={onOpenReport} className={`${btnBase} ${btnPrimary}`}>
            View Today&apos;s Attendance
          </button>
        </div>
      </div>
    );
  }
  if (!existingSubmission && selectedDepartment) {
    return (
      <div className="mt-4 flex justify-center">
        <button type="button" onClick={onOpenReportOnly} className={`px-3 py-2.5 min-h-[44px] touch-manipulation ${isSaqiya ? 'text-theme-primary underline' : 'text-blue-600 underline'}`}>
          View Today&apos;s Attendance
        </button>
      </div>
    );
  }
  return null;
}
