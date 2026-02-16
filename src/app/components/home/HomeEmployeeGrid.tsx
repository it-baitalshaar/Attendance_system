import AttendanceEmployeeCard from '../../component/AttendanceEmployeeCard';
import EmployeeCard from '../../component/EmployeeCard';
import type { AttendanceStatus } from '@/redux/slice';
import { HomeEmployee } from '../../types/home';
import type { DepartmentTheme } from '@/app/constants/themes';

interface HomeEmployeeGridProps {
  loading: boolean;
  displayList: HomeEmployee[];
  showEntryMode: boolean;
  entryMode: 'standard' | 'customize';
  attendanceEntries: Record<string, { status: string; notes: string | null }>;
  cardsLocked: boolean;
  theme?: DepartmentTheme;
}

export function HomeEmployeeGrid({
  loading,
  displayList,
  showEntryMode,
  entryMode,
  attendanceEntries,
  cardsLocked,
  theme,
}: HomeEmployeeGridProps) {
  const themeId = theme?.id;

  if (loading) {
    return (
      <div className="mt-6 sm:mt-8 flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-theme-primary border-t-transparent rounded-full animate-spin" />
        <p className={themeId === 'saqiya' ? 'text-theme-accent' : ''}>Loading employees…</p>
      </div>
    );
  }
  const gridGap = themeId === 'saqiya' ? 'gap-4 sm:gap-6' : 'gap-3 sm:gap-4';
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${gridGap} mt-4 sm:mt-6 w-full max-w-full`}>
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
            themeId={themeId}
          />
        ) : (
          <AttendanceEmployeeCard key={emp.employee_id} employee={emp} disabled={cardsLocked} variant="standard" themeId={themeId} />
        )
      )}
    </div>
  );
}
