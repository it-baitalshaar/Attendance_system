import DatePickerMaxToday from '../../component/DatePickerMaxToday';
import type { DepartmentTheme } from '@/app/constants/themes';

interface HomeDepartmentDateProps {
  selectedDepartment: string;
  userDepartment: string | null;
  selectedDate: string;
  setSelectedDate: (next: string) => void;
  setUserHasUnlocked: (v: boolean) => void;
  DEPARTMENTS: readonly { value: string; label: string }[];
  theme?: DepartmentTheme;
}

export function HomeDepartmentDate({
  selectedDepartment,
  userDepartment,
  selectedDate,
  setSelectedDate,
  setUserHasUnlocked,
  DEPARTMENTS,
  theme,
}: HomeDepartmentDateProps) {
  const isSaqiya = theme?.id === 'saqiya';
  const label =
    selectedDepartment
      ? DEPARTMENTS.find((d) => d.value === selectedDepartment || d.value === selectedDepartment.toLowerCase())?.label ?? selectedDepartment
      : userDepartment
        ? DEPARTMENTS.find((d) => d.value === userDepartment || d.value === (userDepartment as string).toLowerCase())?.label ?? userDepartment
        : '—';

  return (
    <div className="mt-4 sm:mt-6 flex flex-wrap items-center gap-3 sm:gap-4 justify-center">
      <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
        <label className={`font-medium text-sm sm:text-base ${isSaqiya ? 'text-theme-accent' : 'text-black'}`}>Department:</label>
        <span
          className={`px-3 py-2.5 min-h-[44px] inline-flex items-center rounded-theme-card border ${
            isSaqiya ? 'border-theme-accent bg-theme-white text-theme-accent' : 'rounded-lg border bg-gray-50 text-black'
          }`}
        >
          {label}
        </span>
      </div>
      <DatePickerMaxToday
        value={selectedDate}
        onChange={(next) => {
          setUserHasUnlocked(false);
          setSelectedDate(next);
        }}
        className="flex items-center gap-2"
      />
    </div>
  );
}
