interface HomeAttendanceBannerProps {
  selectedDepartment: string;
  selectedDate: string;
  existingSubmission: { submittedAt?: string; submittedByName?: string } | null;
  DEPARTMENTS: readonly { value: string; label: string }[];
}

export function HomeAttendanceBanner({
  selectedDepartment,
  selectedDate,
  existingSubmission,
  DEPARTMENTS,
}: HomeAttendanceBannerProps) {
  const today = new Date().toISOString().split('T')[0];
  const isToday = selectedDate === today;
  if (!selectedDepartment || !selectedDate || !isToday) return null;
  const deptLabel = DEPARTMENTS.find((d) => d.value === selectedDepartment || d.value === selectedDepartment.toLowerCase())?.label ?? selectedDepartment;
  return (
    <div className={`mt-4 w-full max-w-2xl mx-auto px-3 py-3 rounded-lg border ${existingSubmission ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
      {existingSubmission ? (
        <>
          <p className="text-green-800 font-medium text-sm sm:text-base">
            ✅ Attendance already marked for today ({deptLabel})
          </p>
          {existingSubmission.submittedAt && (
            <p className="text-green-700 text-xs sm:text-sm mt-1">
              Submitted at {new Date(existingSubmission.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {existingSubmission.submittedByName ? ` by ${existingSubmission.submittedByName}` : ''}
            </p>
          )}
        </>
      ) : (
        <p className="text-amber-800 font-medium text-sm sm:text-base">
          ⚠️ Attendance NOT marked yet for today ({deptLabel})
        </p>
      )}
    </div>
  );
}
