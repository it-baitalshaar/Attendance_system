import { createSupabbaseFrontendClient } from '@/lib/supabase';
import type { AppDispatch } from '@/redux/store';
import {
  clearAttendanceEntries,
  setAttendanceFromServer,
  setAllPresent,
  setAttendanceStatus,
  setEmployeesStatus,
  setEmployeeProjectsFromServer,
  type AttendanceStatus,
} from '@/redux/slice';
import { HomeEmployee } from '../types/home';
import { buildProjectNameLookup, resolveProjectDisplayName } from '@/lib/projectDisplayName';
import { isUndefinedColumnError } from '@/lib/supabasePostgrestErrors';

export interface LoadAttendanceParams {
  date: string;
  department: string;
  empList: HomeEmployee[];
  userHasUnlocked: boolean;
  setExistingSubmission: (v: any) => void;
  setCardsLocked: (v: boolean) => void;
  setEditMode: (v: boolean) => void;
  setUserHasUnlocked: (v: boolean) => void;
  setEntryMode: (v: 'standard' | 'customize') => void;
}

export async function loadAttendanceForDateAndDepartment(
  dispatch: AppDispatch,
  params: LoadAttendanceParams
): Promise<void> {
  const {
    date,
    department,
    empList,
    userHasUnlocked,
    setExistingSubmission,
    setCardsLocked,
    setEditMode,
    setUserHasUnlocked,
    setEntryMode,
  } = params;
  if (!department || empList.length === 0) return;
  const supabase = createSupabbaseFrontendClient();
  const empIds = empList.map((e) => e.employee_id);
  const loadDate = date.includes('T') ? date.split('T')[0] : date;
  if (userHasUnlocked) return;

  const { data: trackRows } = await supabase
    .from('Track_Attendance')
    .select('id, submitted_by, created_at, last_edited_by, last_edited_at, email')
    .eq('date', loadDate)
    .eq('department', department)
    .order('created_at', { ascending: false })
    .limit(1);

  const track = trackRows?.[0] as { id: string; submitted_by?: string; created_at?: string; email?: string } | undefined;
  if (track) {
    const submittedByName = track.email ?? (track.submitted_by ? String(track.submitted_by).slice(0, 8) : null);
    setExistingSubmission({
      trackId: track.id,
      submittedBy: track.submitted_by,
      submittedAt: track.created_at,
      submittedByName: submittedByName ?? undefined,
    });
    setCardsLocked(true);
    setEditMode(true);
  } else {
    setExistingSubmission(null);
    setCardsLocked(false);
    setEditMode(false);
    setUserHasUnlocked(false);
  }

  const { data: attRows } = await supabase
    .from('Attendance')
    .select('id, employee_id, status, status_attendance, notes')
    .eq('date', loadDate)
    .in('employee_id', empIds);

  dispatch(clearAttendanceEntries());
  if (attRows && attRows.length > 0) {
    const entries = attRows.map((r) => ({
      employee_id: r.employee_id,
      status: (r.status ?? 'present') as AttendanceStatus,
      notes: r.notes ?? null,
    }));
    dispatch(setAttendanceFromServer(entries));
    empIds.forEach((id) => dispatch(setEmployeeProjectsFromServer({ employee_id: id, projects: { projectId: [], tthour: 0 } })));
    attRows.forEach((r) => {
      const status = r.status ?? 'present';
      dispatch(setAttendanceStatus({ status, employee_id: r.employee_id }));
      const dbStatusAttendance = (r as { status_attendance?: string | null }).status_attendance;
      const note = r.notes ?? '';
      let subtype = dbStatusAttendance ?? null;
      if (note.startsWith('Attendance type: ')) {
        const lineEnd = note.indexOf('\n');
        subtype = lineEnd === -1 ? note.slice(18).trim() : note.slice(18, lineEnd).trim();
      }
      const validSubtypes = ['Present', 'Weekend', 'Holiday-Work', 'Sick Leave', 'Absence with excuse', 'Absence without excuse', 'vacation'];
      if (subtype && validSubtypes.includes(subtype)) {
        dispatch(setEmployeesStatus({ status: subtype, employee_id: r.employee_id }));
      } else if (dbStatusAttendance && validSubtypes.includes(dbStatusAttendance)) {
        dispatch(setEmployeesStatus({ status: dbStatusAttendance, employee_id: r.employee_id }));
      }
    });

    const attendanceIdByEmployee = new Map<string, string>();
    const attendanceIds: string[] = [];
    attRows.forEach((r) => {
      if (r.id) {
        attendanceIds.push(r.id);
        attendanceIdByEmployee.set(r.employee_id, r.id);
      }
    });
    if (attendanceIds.length > 0) {
      let attProjRows: {
        attendance_id: string;
        project_id: string;
        working_hours: number | null;
        overtime_hours: number | null;
        overtime_type?: string | null;
      }[] | null = null;
      let attProjErr = null as { message?: string; code?: string } | null;

      const withType = await supabase
        .from('Attendance_projects')
        .select('attendance_id, project_id, working_hours, overtime_hours, overtime_type')
        .in('attendance_id', attendanceIds);

      if (withType.error && isUndefinedColumnError(withType.error)) {
        const minimal = await supabase
          .from('Attendance_projects')
          .select('attendance_id, project_id, working_hours, overtime_hours')
          .in('attendance_id', attendanceIds);
        attProjRows = minimal.data ?? null;
        attProjErr = minimal.error;
      } else {
        attProjRows = withType.data ?? null;
        attProjErr = withType.error;
      }

      if (!attProjErr && attProjRows) {
        const projectIds = Array.from(new Set(attProjRows.map((r) => r.project_id).filter(Boolean)));
        let projectNameById = new Map<string, string>();
        if (projectIds.length > 0) {
          const { data: projRows } = await supabase
            .from('projects')
            .select('project_id, project_name')
            .in('project_id', projectIds);
          projectNameById = buildProjectNameLookup(
            (projRows ?? []) as { project_id: string; project_name: string }[]
          );
        }
        const rowsByAttendanceId = new Map<string, typeof attProjRows>();
        attProjRows.forEach((r) => {
          const key = r.attendance_id;
          if (!rowsByAttendanceId.has(key)) rowsByAttendanceId.set(key, []);
          rowsByAttendanceId.get(key)!.push(r);
        });
        attendanceIdByEmployee.forEach((attendanceId, employee_id) => {
          const rows = rowsByAttendanceId.get(attendanceId) ?? [];
          if (rows.length === 0) {
            dispatch(setEmployeeProjectsFromServer({ employee_id, projects: { projectId: [], tthour: 0 } }));
            return;
          }
          const projectId = rows.map((row) => {
            const label = resolveProjectDisplayName(row.project_id, projectNameById);
            return {
              projectName: [label],
              hours: Number(row.working_hours ?? 0),
              overtime: Number(row.overtime_hours ?? 0),
              overtime_type: row.overtime_type ?? 'normal',
              note: null,
            };
          });
          const tthour = projectId.reduce((sum: number, p: (typeof projectId)[0]) => sum + (Number(p.hours) || 0), 0);
          dispatch(setEmployeeProjectsFromServer({ employee_id, projects: { projectId, tthour } }));
        });
      }
    }
    const hadCustomizedData = attRows.some((r) => {
      const n = r.notes ?? '';
      return n.startsWith('Attendance type: ') || n.includes('Projects: ');
    });
    if (hadCustomizedData) setEntryMode('customize');
  } else {
    dispatch(setAllPresent(empIds));
  }
}
