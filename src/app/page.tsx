'use client';

import Image from 'next/image';
import log from '@/app/assets/logo (1).webp';
import DatePickerMaxToday from './component/DatePickerMaxToday';
import AttendanceEmployeeCard from './component/AttendanceEmployeeCard';
import EmployeeCard from './component/EmployeeCard';
import { createSupabbaseFrontendClient } from '@/lib/supabase';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/redux/store';
import {
  setDepartment,
  setEmployeeData,
  setAllPresent,
  setAttendanceFromServer,
  clearAttendanceEntries,
  setAttendanceStatus,
  setEmployeesStatus,
  type AttendanceStatus,
} from '@/redux/slice';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Employee {
  employee_id: string;
  name: string;
  position?: string;
  department?: string;
}

const DEPARTMENTS = [
  { value: 'construction', label: 'Construction' },
  { value: 'Maintenance', label: 'Maintenance' },
] as const;

async function fetchEmployees(department: string): Promise<Employee[]> {
  const supabase = createSupabbaseFrontendClient();
  const { data, error } = await supabase
    .from('Employee')
    .select('employee_id, name, position, department')
    .eq('department', department)
    .eq('status', 'active');
  if (error) {
    console.error('Error fetching employees:', error);
    return [];
  }
  return (data ?? []) as Employee[];
}

export default function Home() {
  const router = useRouter();
  const dispatch = useDispatch();
  const reduxDepartment = useSelector((state: RootState) => state.project.department);
  const attendanceEntries = useSelector((state: RootState) => state.project.attendanceEntries);
  const employees = useSelector((state: RootState) => state.project.employees);

  const [selectedDate, setSelectedDate] = useState<string>(() =>
    new Date().toISOString().split('T')[0]
  );
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [userDisplay, setUserDisplay] = useState<{ name?: string; email?: string; id?: string } | null>(null);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [showOnlyExceptions, setShowOnlyExceptions] = useState(false);
  const [confirmModal, setConfirmModal] = useState<'idle' | 'open' | 'submitting'>('idle');
  const [reportModal, setReportModal] = useState(false);
  const [reportData, setReportData] = useState<{
    date: string;
    department: string;
    submittedBy?: string;
    submittedAt?: string;
    lastEditedBy?: string;
    lastEditedAt?: string;
    present: number;
    absent: number;
    vacation: number;
    nonPresentList: { name: string; status: string; notes?: string | null }[];
  } | null>(null);
  const [existingSubmission, setExistingSubmission] = useState<{
    trackId: string;
    submittedBy?: string;
    submittedAt?: string;
  } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [cardsLocked, setCardsLocked] = useState(false);
  /** For Construction only: 'standard' = quick (Present/Absent/Vacation), 'customize' = with attendance type (Half Day, Weekend, etc.) */
  const [entryMode, setEntryMode] = useState<'standard' | 'customize'>('standard');

  const selectedDepartment = reduxDepartment ?? '';
  const departmentForFetch =
    selectedDepartment === 'Construction' || selectedDepartment === 'construction'
      ? 'construction'
      : selectedDepartment;
  const isConstruction = departmentForFetch === 'construction';
  const isMaintenance = departmentForFetch === 'Maintenance';
  const showEntryMode = isConstruction || isMaintenance;

  const setSelectedDepartment = useCallback(
    (dept: string) => {
      dispatch(setDepartment(dept));
    },
    [dispatch]
  );

  const loadAttendanceForDateAndDepartment = useCallback(
    async (date: string, department: string, empList?: Employee[]) => {
      if (!department) return;
      const supabase = createSupabbaseFrontendClient();
      const list = empList ?? employeeList;
      const empIds = list.map((e) => e.employee_id);
      if (empIds.length === 0) return;

      const { data: trackRows } = await supabase
        .from('Track_Attendance')
        .select('id, submitted_by, created_at, last_edited_by, last_edited_at')
        .eq('date', date)
        .eq('department', department)
        .order('created_at', { ascending: false })
        .limit(1);

      const track = trackRows?.[0];
      if (track) {
        setExistingSubmission({
          trackId: track.id,
          submittedBy: track.submitted_by,
          submittedAt: track.created_at,
        });
        setCardsLocked(true);
        setEditMode(true);
      } else {
        setExistingSubmission(null);
        setCardsLocked(false);
        setEditMode(false);
      }

      const { data: attRows } = await supabase
        .from('Attendance')
        .select('employee_id, status, notes')
        .eq('date', date)
        .in('employee_id', empIds);

      dispatch(clearAttendanceEntries());
      if (attRows && attRows.length > 0) {
        const entries = attRows.map((r) => ({
          employee_id: r.employee_id,
          status: (r.status ?? 'present') as AttendanceStatus,
          notes: r.notes ?? null,
        }));
        dispatch(setAttendanceFromServer(entries));
        attRows.forEach((r) => {
          dispatch(setAttendanceStatus({ status: r.status ?? 'present', employee_id: r.employee_id }));
          const note = r.notes ?? '';
          if (note.startsWith('Attendance type: ')) {
            const lineEnd = note.indexOf('\n');
            const type = lineEnd === -1 ? note.slice(18).trim() : note.slice(18, lineEnd).trim();
            if (type) dispatch(setEmployeesStatus({ status: type, employee_id: r.employee_id }));
          }
        });
        const hadCustomizedData = attRows.some((r) => {
          const n = r.notes ?? '';
          return n.startsWith('Attendance type: ') || n.includes('Projects: ');
        });
        if (hadCustomizedData) setEntryMode('customize');
      } else {
        dispatch(setAllPresent(empIds));
      }
    },
    [employeeList, dispatch]
  );

  useEffect(() => {
    if (!selectedDepartment) {
      setEmployeeList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchEmployees(departmentForFetch).then((list) => {
      setEmployeeList(list);
      const augmented = list.map((e) => ({
        ...e,
        employee_status: [{ status_attendance: null, status_employee: null, note: null }],
        projects: { projectId: [], tthour: 0 },
      }));
      dispatch(setEmployeeData(augmented));
      setLoading(false);
      loadAttendanceForDateAndDepartment(selectedDate, departmentForFetch, list);
    });
    // Intentionally omit loadAttendanceForDateAndDepartment to avoid loop: we call it in .then() with fresh `list`.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDepartment, departmentForFetch, dispatch, selectedDate]);

  useEffect(() => {
    if (selectedDate && departmentForFetch && employeeList.length > 0) {
      loadAttendanceForDateAndDepartment(selectedDate, departmentForFetch, employeeList);
    }
  }, [selectedDate]);

  useEffect(() => {
    let cancelled = false;
    async function loadUser() {
      const supabase = createSupabbaseFrontendClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      const name =
        user.user_metadata?.full_name ||
        user.email?.split('@')[0] ||
        user.id.slice(0, 8);
      setUserDisplay({ name, email: user.email ?? undefined, id: user.id });
      const { data: profile } = await supabase
        .from('profiles')
        .select('Department, role')
        .eq('id', user.id)
        .single();
      if (cancelled) return;
      if (profile) {
        setUserDepartment(profile.Department ?? null);
        dispatch(setDepartment(profile.Department ?? ''));
      }
    }
    loadUser();
    return () => { cancelled = true; };
  }, [dispatch]);

  const handleLogout = async () => {
    const supabase = createSupabbaseFrontendClient();
    try {
      await supabase.auth.signOut();
      router.replace('/login');
    } catch (e) {
      console.error(e);
    }
  };

  const getStatus = (emp: Employee) =>
    showEntryMode && entryMode === 'customize'
      ? ((employees.find((r) => r.employee_id === emp.employee_id) as { employee_status?: { status_attendance: string | null }[] } | undefined)?.employee_status?.[0]?.status_attendance ?? 'present')
      : (attendanceEntries[emp.employee_id]?.status ?? 'present');

  const displayList = showOnlyExceptions
    ? employeeList.filter((e) => getStatus(e) !== 'present')
    : employeeList;

  const presentCount = employeeList.filter((e) => getStatus(e) === 'present').length;
  const absentCount = employeeList.filter((e) => getStatus(e) === 'absent').length;
  const vacationCount = employeeList.filter((e) => getStatus(e) === 'vacation').length;

  const handleSubmitClick = () => {
    if (!selectedDepartment) {
      alert('Please select a department.');
      return;
    }
    setConfirmModal('open');
  };

  const handleConfirmSubmit = async () => {
    const supabase = createSupabbaseFrontendClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('You must be logged in to submit.');
      return;
    }
    if (!selectedDepartment || employeeList.length === 0) {
      setConfirmModal('idle');
      return;
    }

    setConfirmModal('submitting');

    // Build entries for report (used later)
    let entries: Array<{ employee_id: string; status: AttendanceStatus; notes: string | null }> = [];
    
    try {
      let res: Response;
      // Check if any employee has projects (Standard or Customize with projects)
      const hasProjects = employees.some((emp) => {
        const proj = emp.projects?.projectId;
        return proj && proj.length > 0 && proj.some((p: { projectName?: string[]; hours?: number }) => p.projectName?.length && (p.hours ?? 0) > 0);
      });

      if ((showEntryMode && entryMode === 'customize') || (showEntryMode && hasProjects)) {
        // Use legacy flow when Customize OR when Standard has projects - saves to Attendance_projects
        const employeesPayload = employeeList.map((e) => {
          const reduxEmp = employees.find((r) => r.employee_id === e.employee_id) as
            | { employee_status?: { status_attendance: string | null; status_employee?: string | null; note: string | null }[]; projects?: { projectId: { projectName: string[]; hours: number; overtime: number; note: string | null }[]; tthour: number } }
            | undefined;
          return {
            employee_id: e.employee_id,
            name: e.name,
            position: e.position,
            department: e.department,
            projects: reduxEmp?.projects ?? { projectId: [], tthour: 0 },
          };
        });
        const employees_statis = employeeList.map((e) => {
          const reduxEmp = employees.find((r) => r.employee_id === e.employee_id) as
            | { employee_status?: { status_attendance: string | null; status_employee?: string | null; note: string | null }[] }
            | undefined;
          return {
            employee_id: e.employee_id,
            employee_status: reduxEmp?.employee_status ?? [{ status_attendance: null, status_employee: null, note: null }],
          };
        });
        
        // Build entries for report
        entries = employeeList.map((e) => {
          const reduxEmp = employees.find((r) => r.employee_id === e.employee_id) as
            | { employee_status?: { status_attendance: string | null; status_employee?: string | null; note: string | null }[] }
            | undefined;
          const status = (reduxEmp?.employee_status?.[0]?.status_attendance ?? 'present') as AttendanceStatus;
          const notes = reduxEmp?.employee_status?.[0]?.note ?? null;
          return { employee_id: e.employee_id, status, notes };
        });
        
        res = await fetch('/api/submitAttendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employees: employeesPayload,
            employees_statis,
            department: departmentForFetch,
            selectedDate,
          }),
        });
      } else {
        // Simplified flow for Standard mode without projects
        entries = employeeList.map((e) => ({
          employee_id: e.employee_id,
          status: (attendanceEntries[e.employee_id]?.status ?? 'present') as AttendanceStatus,
          notes: attendanceEntries[e.employee_id]?.notes ?? null,
        }));
        res = await fetch('/api/submitAttendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attendancePayload: {
              date: selectedDate,
              department: departmentForFetch,
              submitted_by: user.id,
              entries,
            },
          }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || 'Failed to submit attendance.');
        setConfirmModal('open');
        return;
      }
      setConfirmModal('idle');
      setCardsLocked(true);
      setEditMode(true);
      setExistingSubmission((prev) => ({ ...prev!, submittedBy: user.id }));
      const nonPresentList = employeeList
        .filter((e) => getStatus(e) !== 'present')
        .map((e) => {
          const notesEntry = entries.find((ent) => ent.employee_id === e.employee_id);
          return {
            name: e.name,
            status: getStatus(e) ?? '',
            notes: notesEntry?.notes ?? null,
          };
        });
      setReportData({
        date: selectedDate,
        department: departmentForFetch,
        submittedBy: user.id,
        submittedAt: new Date().toISOString(),
        present: presentCount,
        absent: absentCount,
        vacation: vacationCount,
        nonPresentList,
      });
      setReportModal(true);
    } catch (e) {
      alert('Error submitting attendance.');
      setConfirmModal('open');
    }
  };

  const handleEditAttendance = () => {
    setCardsLocked(false);
  };

  const openReportModal = async () => {
    if (!departmentForFetch || !selectedDate) return;
    const supabase = createSupabbaseFrontendClient();
    const { data: trackRows } = await supabase
      .from('Track_Attendance')
      .select('id, submitted_by, created_at, last_edited_by, last_edited_at')
      .eq('date', selectedDate)
      .eq('department', departmentForFetch)
      .order('created_at', { ascending: false })
      .limit(1);
    const track = trackRows?.[0];
    const empIds = employeeList.map((e) => e.employee_id);
    const { data: attRows } = await supabase
      .from('Attendance')
      .select('employee_id, status, notes')
      .eq('date', selectedDate)
      .in('employee_id', empIds);

    const present = (attRows ?? []).filter((r) => r.status === 'present').length;
    const absent = (attRows ?? []).filter((r) => r.status === 'absent').length;
    const vacation = (attRows ?? []).filter((r) => r.status === 'vacation').length;
    const nameMap = Object.fromEntries(employeeList.map((e) => [e.employee_id, e.name]));
    const nonPresentList = (attRows ?? [])
      .filter((r) => r.status !== 'present')
      .map((r) => ({
        name: nameMap[r.employee_id] ?? r.employee_id,
        status: r.status ?? '',
        notes: r.notes ?? null,
      }));

    setReportData({
      date: selectedDate,
      department: departmentForFetch,
      submittedBy: track?.submitted_by,
      submittedAt: track?.created_at,
      lastEditedBy: track?.last_edited_by,
      lastEditedAt: track?.last_edited_at,
      present,
      absent,
      vacation,
      nonPresentList,
    });
    setReportModal(true);
  };

  return (
    <main className="mt-4 sm:mt-8 flex flex-col items-center justify-center relative min-h-screen pb-12 px-3 sm:px-4">
      <button
        onClick={handleLogout}
        className="absolute top-0 right-2 sm:right-4 bg-red-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded text-sm sm:text-base hover:bg-red-700 touch-manipulation"
      >
        Logout
      </button>

      <div className="flex flex-col items-center justify-center w-full max-w-4xl">
        <div className="flex flex-col justify-center items-center">
          <Image src={log} alt="Logo" width={120} height={37} priority />
          <h1 className="text-xl sm:text-2xl mt-4 mb-2">Bait Alshaar</h1>
          <h1 className="text-xl sm:text-2xl text-black mt-2 text-center">Welcome</h1>
        </div>

        {userDisplay && (
          <p className="mt-4 text-gray-700 font-medium text-sm sm:text-base text-center max-w-full break-words px-2">
            Logged in as: <span className="uppercase">{userDisplay.name}</span>
            {userDisplay.email && (
              <span className="text-gray-500 text-xs sm:text-sm ml-1 sm:ml-2 block sm:inline">({userDisplay.email})</span>
            )}
          </p>
        )}

        <div className="mt-4 sm:mt-6 flex flex-wrap items-center gap-3 sm:gap-4 justify-center">
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <label className="text-black font-medium text-sm sm:text-base">Department:</label>
            <span className="text-black px-3 py-2.5 rounded-lg border bg-gray-50 min-h-[44px] inline-flex items-center">
              {selectedDepartment
                ? DEPARTMENTS.find((d) => d.value === selectedDepartment || d.value === selectedDepartment.toLowerCase())?.label ?? selectedDepartment
                : userDepartment
                  ? DEPARTMENTS.find((d) => d.value === userDepartment || d.value === (userDepartment as string).toLowerCase())?.label ?? userDepartment
                  : '—'}
            </span>
          </div>
          <DatePickerMaxToday
            value={selectedDate}
            onChange={setSelectedDate}
            className="flex items-center gap-2"
          />
        </div>

        {selectedDepartment && (
          <>
            <p className="mt-4 text-gray-600 text-sm italic text-center sm:text-left">
              All employees are marked Present by default. Change only exceptions.
            </p>
            {showEntryMode && (
              <div className="mt-4 w-full max-w-md mx-auto sm:mx-0">
                <p className="text-black font-medium text-sm mb-2 text-center sm:text-left">Entry mode</p>
                <div className="flex rounded-xl overflow-hidden border border-gray-300 bg-gray-100 p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setEntryMode('standard')}
                    className={`flex-1 min-h-[44px] py-2.5 px-4 rounded-lg text-sm font-medium transition touch-manipulation ${
                      entryMode === 'standard'
                        ? 'bg-white text-[#710D15] shadow'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryMode('customize')}
                    className={`flex-1 min-h-[44px] py-2.5 px-4 rounded-lg text-sm font-medium transition touch-manipulation ${
                      entryMode === 'customize'
                        ? 'bg-white text-[#710D15] shadow'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Customize
                  </button>
                </div>
                <p className="mt-1.5 text-gray-500 text-xs text-center sm:text-left">
                  {entryMode === 'standard'
                    ? 'Quick: Present, Absent, or Vacation only.'
                    : 'Detailed: add attendance type (e.g. Half Day, Weekend) when Present.'}
                </p>
              </div>
            )}
            <label className="mt-4 flex items-center gap-2 text-black">
              <input
                type="checkbox"
                checked={showOnlyExceptions}
                onChange={(e) => setShowOnlyExceptions(e.target.checked)}
              />
              Show only Absent / Vacation
            </label>
          </>
        )}

        {existingSubmission && cardsLocked && (
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
            <span className="text-amber-700 font-medium text-sm sm:text-base text-center sm:text-left">
              Attendance already submitted for this date and department.
            </span>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
              <button
                type="button"
                onClick={handleEditAttendance}
                className="px-3 py-2.5 min-h-[44px] bg-amber-600 text-white rounded hover:bg-amber-700 touch-manipulation"
              >
                Edit Attendance
              </button>
              <button
                type="button"
                onClick={openReportModal}
                className="px-3 py-2.5 min-h-[44px] bg-blue-600 text-white rounded hover:bg-blue-700 touch-manipulation"
              >
                View Today&apos;s Attendance
              </button>
            </div>
          </div>
        )}

        {!existingSubmission && selectedDepartment && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={openReportModal}
              className="px-3 py-2.5 min-h-[44px] text-blue-600 underline touch-manipulation"
            >
              View Today&apos;s Attendance
            </button>
          </div>
        )}

        {editMode && !cardsLocked && (
          <p className="mt-2 text-amber-700 text-sm">
            You are editing an already submitted attendance.
          </p>
        )}

        {loading ? (
          <p className="mt-6 sm:mt-8">Loading employees…</p>
        ) : (
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
                  initialStatus={attendanceEntries[emp.employee_id]?.status ?? 'present'}
                  initialNotes={attendanceEntries[emp.employee_id]?.notes ?? null}
                />
              ) : (
                <AttendanceEmployeeCard
                  key={emp.employee_id}
                  employee={emp}
                  disabled={cardsLocked}
                  variant="standard"
                />
              )
            )}
          </div>
        )}

        {selectedDepartment && employeeList.length > 0 && (
          <div className="mt-6 sm:mt-8 w-full flex justify-center">
            <button
              type="button"
              onClick={handleSubmitClick}
              disabled={cardsLocked}
              className="w-full sm:w-auto min-h-[48px] px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 touch-manipulation"
            >
              Submit Attendance
            </button>
          </div>
        )}
      </div>

      {confirmModal === 'open' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl p-4 sm:p-6 max-w-md w-full shadow-xl my-4">
            <h3 className="text-lg sm:text-xl font-semibold mb-4">Confirm submission</h3>
            <p className="text-gray-600 mb-2">Date: {selectedDate}</p>
            <p className="text-gray-600 mb-2">Department: {selectedDepartment}</p>
            <p className="text-gray-600 mb-2">Total employees: {employeeList.length}</p>
            <p className="text-green-600 mb-1">Present: {presentCount}</p>
            <p className="text-red-600 mb-1">Absent: {absentCount}</p>
            <p className="text-yellow-600 mb-4">Vacation: {vacationCount}</p>
            <div className="flex gap-3 justify-end flex-wrap">
              <button
                type="button"
                onClick={() => setConfirmModal('idle')}
                className="min-h-[44px] px-4 py-2 border rounded-lg touch-manipulation"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                className="min-h-[44px] px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 touch-manipulation"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal === 'submitting' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
            <p>Submitting…</p>
          </div>
        </div>
      )}

      {reportModal && reportData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl p-4 sm:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl my-4">
            <h3 className="text-lg sm:text-xl font-semibold mb-4">Today&apos;s Attendance Summary</h3>
            <p><strong>Date:</strong> {reportData.date}</p>
            <p><strong>Department:</strong> {reportData.department}</p>
            {reportData.submittedAt && (
              <p><strong>Submission time:</strong> {new Date(reportData.submittedAt).toLocaleString()}</p>
            )}
            <p className="text-green-600 mt-2">Present: {reportData.present}</p>
            <p className="text-red-600">Absent: {reportData.absent}</p>
            <p className="text-yellow-600">Vacation: {reportData.vacation}</p>
            {reportData.nonPresentList.length > 0 && (
              <>
                <p className="font-medium mt-4">Non-present employees:</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  {reportData.nonPresentList.map((item, i) => (
                    <li key={i}>
                      {item.name} – {item.status}
                      {item.notes && ` (${item.notes})`}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setReportModal(false)}
                className="min-h-[44px] px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 touch-manipulation"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
