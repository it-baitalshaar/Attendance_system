interface HomeLockedBannerProps {
  existingSubmission: unknown;
  cardsLocked: boolean;
  onEditAttendance: () => void;
  onOpenReport: () => void;
  selectedDepartment: string;
  onOpenReportOnly: () => void;
}

export function HomeLockedBanner({
  existingSubmission,
  cardsLocked,
  onEditAttendance,
  onOpenReport,
  selectedDepartment,
  onOpenReportOnly,
}: HomeLockedBannerProps) {
  if (existingSubmission && cardsLocked) {
    return (
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
        <span className="text-amber-700 font-medium text-sm sm:text-base text-center sm:text-left">
          Attendance already submitted for this date and department.
        </span>
        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
          <button type="button" onClick={onEditAttendance} className="px-3 py-2.5 min-h-[44px] bg-amber-600 text-white rounded hover:bg-amber-700 touch-manipulation">
            Edit Attendance
          </button>
          <button type="button" onClick={onOpenReport} className="px-3 py-2.5 min-h-[44px] bg-blue-600 text-white rounded hover:bg-blue-700 touch-manipulation">
            View Today&apos;s Attendance
          </button>
        </div>
      </div>
    );
  }
  if (!existingSubmission && selectedDepartment) {
    return (
      <div className="mt-4 flex justify-center">
        <button type="button" onClick={onOpenReportOnly} className="px-3 py-2.5 min-h-[44px] text-blue-600 underline touch-manipulation">
          View Today&apos;s Attendance
        </button>
      </div>
    );
  }
  return null;
}
