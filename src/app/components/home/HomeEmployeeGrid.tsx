import AttendanceEmployeeCard from '../../component/AttendanceEmployeeCard';
import EmployeeCard from '../../component/EmployeeCard';
import type { AttendanceStatus } from '@/redux/slice';
import { HomeEmployee } from '../../types/home';

interface HomeEmployeeGridProps {
  loading: boolean;
  displayList: HomeEmployee[];
  showEntryMode: boolean;
  entryMode: 'standard' | 'customize';
  attendanceEntries: Record<string, { status: string; notes: string | null }>;
  cardsLocked: boolean;
}

export function HomeEmployeeGrid({
  loading,
  displayList,
  showEntryMode,
  entryMode,
  attendanceEntries,
  cardsLocked,
}: HomeEmployeeGridProps) {
  if (loading) {
    return <p className="mt-6 sm:mt-8">Loading employees…</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-4 sm:mt-6 w-full max-w-full">
      {displayList.map((emp) =>
        showEntryMode ? (
          <EmployeeCard
            key={emp.employee_id}
            employee={{ id: emp.employee_id, employee_id: emp.employee_id, name: emp.name, position: emp.position ?? '' }}
            hideModeToggle
            isCustomizeFromParent={entryMode === 'customize'}
            showProjectsWhenPresent={entryMode === 'standard'}
            disabled={cardsLocked}
            initialStatus={(attendanceEntries[emp.employee_id]?.status ?? 'present') as AttendanceStatus}
            initialNotes={attendanceEntries[emp.employee_id]?.notes ?? null}
          />
        ) : (
          <AttendanceEmployeeCard key={emp.employee_id} employee={emp} disabled={cardsLocked} variant="standard" />
        )
      )}
    </div>
  );
}
