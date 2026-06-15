import { fetchDepartmentsService } from '@/app/admin/services/departmentService';
import { fetchHolidaysForDepartment } from '@/app/admin/services/holidayService';
import {
  resolveWeekendDaysForDepartment,
  type OvertimeCalendarConfig,
} from '@/app/lib/overtimeCalendar';

/** Load weekend days + holiday dates for a field department (home + loadAttendance). */
export async function fetchCalendarConfigForDepartment(
  departmentName: string
): Promise<OvertimeCalendarConfig> {
  const trimmed = departmentName.trim();
  if (!trimmed) {
    return {
      weekendDays: [],
      holidayDates: [],
      allowHolidayOvertime: true,
      allowPublicHolidayOvertime: true,
    };
  }

  const [depts, holidays] = await Promise.all([
    fetchDepartmentsService(),
    fetchHolidaysForDepartment(trimmed),
  ]);
  const deptRow = depts.find(
    (d) => d.name.trim().toLowerCase() === trimmed.toLowerCase()
  );

  return {
    weekendDays: resolveWeekendDaysForDepartment(trimmed, deptRow?.weekend_days),
    holidayDates: holidays.map((h) => h.holiday_date),
    allowHolidayOvertime: deptRow?.allow_holiday_overtime !== false,
    allowPublicHolidayOvertime: deptRow?.allow_public_holiday_overtime !== false,
  };
}
