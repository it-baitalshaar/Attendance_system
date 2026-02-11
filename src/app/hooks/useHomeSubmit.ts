'use client';

import { useState } from 'react';
import { createSupabbaseFrontendClient } from '@/lib/supabase';
import type { AttendanceStatus } from '@/redux/slice';
import { HomeEmployee } from '../types/home';
import { ReportData } from '../types/home';

export interface HomeSubmitState {
  employeeList: HomeEmployee[];
  selectedDepartment: string;
  departmentForFetch: string;
  selectedDate: string;
  employees: any[];
  attendanceEntries: Record<string, { status: string; notes: string | null }>;
  getStatus: (emp: HomeEmployee) => string;
  presentCount: number;
  absentCount: number;
  vacationCount: number;
  showEntryMode: boolean;
  entryMode: 'standard' | 'customize';
  setExistingSubmission: (v: any) => void;
  setCardsLocked: (v: boolean) => void;
  setEditMode: (v: boolean) => void;
  setUserHasUnlocked: (v: boolean) => void;
}

export function useHomeSubmit(state: HomeSubmitState) {
  const [confirmModal, setConfirmModal] = useState<'idle' | 'open' | 'submitting'>('idle');
  const [reportModal, setReportModal] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const { setExistingSubmission, setCardsLocked, setEditMode, setUserHasUnlocked } = state;

  const handleSubmitClick = () => {
    if (!state.selectedDepartment) {
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
    if (!state.selectedDepartment || state.employeeList.length === 0) {
      setConfirmModal('idle');
      return;
    }
    setConfirmModal('submitting');

    let entries: Array<{ employee_id: string; status: AttendanceStatus; notes: string | null }> = [];

    try {
      if (state.showEntryMode) {
        const employeesPayload = state.employeeList.map((e) => {
          const reduxEmp = state.employees.find((r: any) => r.employee_id === e.employee_id);
          return {
            employee_id: e.employee_id,
            name: e.name,
            position: e.position,
            department: e.department,
            projects: reduxEmp?.projects ?? { projectId: [], tthour: 0 },
          };
        });
        const employees_statis = state.employeeList.map((e) => {
          const reduxEmp = state.employees.find((r: any) => r.employee_id === e.employee_id);
          return {
            employee_id: e.employee_id,
            employee_status: reduxEmp?.employee_status ?? [{ status_attendance: null, status_employee: null, note: null }],
          };
        });
        entries = state.employeeList.map((e) => {
          const reduxEmp = state.employees.find((r: any) => r.employee_id === e.employee_id);
          const status = (reduxEmp?.employee_status?.[0]?.status_attendance ?? 'present') as AttendanceStatus;
          const notes = reduxEmp?.employee_status?.[0]?.note ?? null;
          return { employee_id: e.employee_id, status, notes };
        });
        const res = await fetch('/api/submitAttendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employees: employeesPayload,
            employees_statis,
            department: state.departmentForFetch,
            selectedDate: state.selectedDate,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert(data?.error || 'Failed to submit attendance.');
          setConfirmModal('open');
          return;
        }
      } else {
        entries = state.employeeList.map((e) => ({
          employee_id: e.employee_id,
          status: (state.attendanceEntries[e.employee_id]?.status ?? 'present') as AttendanceStatus,
          notes: state.attendanceEntries[e.employee_id]?.notes ?? null,
        }));
        const res = await fetch('/api/submitAttendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attendancePayload: {
              date: state.selectedDate,
              department: state.departmentForFetch,
              submitted_by: user.id,
              entries,
            },
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert(data?.error || 'Failed to submit attendance.');
          setConfirmModal('open');
          return;
        }
      }

      setConfirmModal('idle');
      setCardsLocked(true);
      setEditMode(true);
      setUserHasUnlocked(false);
      setExistingSubmission((prev: any) => ({ ...prev!, submittedBy: user.id }));
      const nonPresentList = state.employeeList
        .filter((e) => state.getStatus(e) !== 'present')
        .map((e) => {
          const notesEntry = entries.find((ent) => ent.employee_id === e.employee_id);
          return { name: e.name, status: state.getStatus(e) ?? '', notes: notesEntry?.notes ?? null };
        });
      setReportData({
        date: state.selectedDate,
        department: state.departmentForFetch,
        submittedBy: user.id,
        submittedAt: new Date().toISOString(),
        present: state.presentCount,
        absent: state.absentCount,
        vacation: state.vacationCount,
        nonPresentList,
      });
      setReportModal(true);
    } catch {
      alert('Error submitting attendance.');
      setConfirmModal('open');
    }
  };

  const handleEditAttendance = () => {
    setUserHasUnlocked(true);
    setCardsLocked(false);
  };

  const openReportModal = async () => {
    if (!state.departmentForFetch || !state.selectedDate) return;
    const supabase = createSupabbaseFrontendClient();
    const reportDate = state.selectedDate.includes('T') ? state.selectedDate.split('T')[0] : state.selectedDate;
    const { data: trackRows } = await supabase
      .from('Track_Attendance')
      .select('id, submitted_by, created_at, last_edited_by, last_edited_at')
      .eq('date', reportDate)
      .eq('department', state.departmentForFetch)
      .order('created_at', { ascending: false })
      .limit(1);
    const track = trackRows?.[0];
    const empIds = state.employeeList.map((e) => e.employee_id);
    const { data: attRows } = await supabase
      .from('Attendance')
      .select('employee_id, status, notes')
      .eq('date', reportDate)
      .in('employee_id', empIds);
    const present = (attRows ?? []).filter((r) => r.status === 'present').length;
    const absent = (attRows ?? []).filter((r) => r.status === 'absent').length;
    const vacation = (attRows ?? []).filter((r) => r.status === 'vacation').length;
    const nameMap = Object.fromEntries(state.employeeList.map((e) => [e.employee_id, e.name]));
    const nonPresentList = (attRows ?? [])
      .filter((r) => r.status !== 'present')
      .map((r) => ({
        name: nameMap[r.employee_id] ?? r.employee_id,
        status: r.status ?? '',
        notes: r.notes ?? null,
      }));
    setReportData({
      date: state.selectedDate,
      department: state.departmentForFetch,
      submittedBy: (track as any)?.submitted_by,
      submittedAt: (track as any)?.created_at,
      lastEditedBy: (track as any)?.last_edited_by,
      lastEditedAt: (track as any)?.last_edited_at,
      present,
      absent,
      vacation,
      nonPresentList,
    });
    setReportModal(true);
  };

  return {
    confirmModal,
    setConfirmModal,
    reportModal,
    reportData,
    setReportModal,
    handleSubmitClick,
    handleConfirmSubmit,
    handleEditAttendance,
    openReportModal,
  };
}
