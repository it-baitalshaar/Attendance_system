import DatePickerMaxToday from '../../component/DatePickerMaxToday';
interface HomeDepartmentDateProps {
  selectedDepartment: string;
  userDepartment: string | null;
  selectedDate: string;
  setSelectedDate: (next: string) => void;
  setUserHasUnlocked: (v: boolean) => void;
  DEPARTMENTS: readonly { value: string; label: string }[];
}

export function HomeDepartmentDate({
  selectedDepartment,
  userDepartment,
  selectedDate,
  setSelectedDate,
  setUserHasUnlocked,
  DEPARTMENTS,
}: HomeDepartmentDateProps) {
  const label =
    selectedDepartment
      ? DEPARTMENTS.find((d) => d.value === selectedDepartment || d.value === selectedDepartment.toLowerCase())?.label ?? selectedDepartment
      : userDepartment
        ? DEPARTMENTS.find((d) => d.value === userDepartment || d.value === (userDepartment as string).toLowerCase())?.label ?? userDepartment
        : '—';

  return (
    <div className="mt-4 sm:mt-6 flex flex-wrap items-center gap-3 sm:gap-4 justify-center">
      <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
        <label className="text-black font-medium text-sm sm:text-base">Department:</label>
        <span className="text-black px-3 py-2.5 rounded-lg border bg-gray-50 min-h-[44px] inline-flex items-center">
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
