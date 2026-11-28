'use client';

import { useState, useRef, useCallback } from 'react';
import { createSupabbaseFrontendClient } from '@/lib/supabase';
import type { AttendanceStatus } from '@/redux/slice';
import { HomeEmployee } from '../types/home';
import { ReportData } from '../types/home';
import {
  keepsProjectHours,
  validateAttendanceSubmission,
  type AttendanceSubmissionRow,
  type AttendanceValidationIssue,
} from '@/app/lib/attendanceSubmissionValidation';

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

function sumPositive(values: unknown[]): number {
  return values.reduce<number>((sum, v) => {
    const n = Number(v);
    return sum + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
}

export function useHomeSubmit(state: HomeSubmitState) {
  const [confirmModal, setConfirmModal] = useState<'idle' | 'open' | 'issues' | 'submitting'>('idle');
  const [reportModal, setReportModal] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [validationIssues, setValidationIssues] = useState<AttendanceValidationIssue[]>([]);
  const [overrideReason, setOverrideReason] = useState('');
  const isSubmittingRef = useRef(false);
  const { setExistingSubmission, setCardsLocked, setEditMode, setUserHasUnlocked } = state;

  /** Rows used by the shared validator — mirrors the payload built at submit time. */
  const buildValidationRows = useCallback((): { rows: AttendanceSubmissionRow[]; checkHours: boolean } => {
    if (state.showEntryMode) {
      const rows = state.employeeList.map((e) => {
        const reduxEmp = state.employees.find((r: any) => r.employee_id === e.employee_id);
        const projectRows = reduxEmp?.projects?.projectId ?? [];
        const status = (reduxEmp?.employee_status?.[0]?.status_attendance ?? 'present') as string;
        const attendanceType = reduxEmp?.employee_status?.[0]?.status_employee ?? null;
        // Absent / vacation days drop project rows at save time — validate only what
        // will actually be persisted (present days and Sick Leave keep their rows).
        const keeps = keepsProjectHours({ status, attendanceType });
        return {
          employee_id: e.employee_id,
          employee_name: e.name,
          status,
          attendance_type: attendanceType,
          notes: reduxEmp?.employee_status?.[0]?.note ?? null,
          hours: keeps ? sumPositive(projectRows.map((p: any) => p?.hours)) : 0,
          overtime_hours: keeps ? sumPositive(projectRows.map((p: any) => p?.overtime)) : 0,
        };
      });
      return { rows, checkHours: true };
    }

    // Simplified flow (e.g. Al Saqiya) — no per-project hours are collected.
    const rows = state.employeeList.map((e) => {
      const entry = state.attendanceEntries[e.employee_id];
      return {
        employee_id: e.employee_id,
        employee_name: e.name,
        status: entry?.status ?? 'present',
        attendance_type: null,
        notes: entry?.notes ?? null,
        hours: 0,
        overtime_hours: 0,
      };
    });
    return { rows, checkHours: false };
  }, [state.employeeList, state.employees, state.attendanceEntries, state.showEntryMode]);

  const clearValidation = useCallback(() => {
    setValidationIssues([]);
    setOverrideReason('');
  }, []);

  const handleSubmitClick = () => {
    if (!state.selectedDepartment) {
      alert('Please select a department.');
      return;
    }

    const { rows, checkHours } = buildValidationRows();
    const issues = validateAttendanceSubmission(rows, { checkHours });

    if (issues.length > 0) {
      setValidationIssues(issues);
      setOverrideReason('');
      setConfirmModal('issues');
      return;
    }

    clearValidation();
    setConfirmModal('open');
  };

  const handleBackToCards = () => {
    clearValidation();
    setConfirmModal('idle');
  };

  const handleConfirmSubmit = async (reason?: string) => {
    if (isSubmittingRef.current) return;
    const overrideText = (reason ?? '').trim();
    isSubmittingRef.current = true;
    const supabase = createSupabbaseFrontendClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('You must be logged in to submit.');
      isSubmittingRef.current = false;
      return;
    }
    if (!state.selectedDepartment || state.employeeList.length === 0) {
      setConfirmModal('idle');
      isSubmittingRef.current = false;
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
            overtime_enabled: reduxEmp?.overtime_enabled !== false,
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
            ...(overrideText ? { validation_override_reason: overrideText } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (data?.code === 'ATTENDANCE_VALIDATION' && Array.isArray(data?.issues)) {
            setValidationIssues(data.issues as AttendanceValidationIssue[]);
            setConfirmModal('issues');
            isSubmittingRef.current = false;
            return;
          }
          alert(data?.error || 'Failed to submit attendance.');
          setConfirmModal(overrideText ? 'issues' : 'open');
          isSubmittingRef.current = false;
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
            ...(overrideText ? { validation_override_reason: overrideText } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (data?.code === 'ATTENDANCE_VALIDATION' && Array.isArray(data?.issues)) {
            setValidationIssues(data.issues as AttendanceValidationIssue[]);
            setConfirmModal('issues');
            isSubmittingRef.current = false;
            return;
          }
          alert(data?.error || 'Failed to submit attendance.');
          setConfirmModal(overrideText ? 'issues' : 'open');
          isSubmittingRef.current = false;
          return;
        }
      }

      setConfirmModal('idle');
      clearValidation();
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
      setConfirmModal(overrideText ? 'issues' : 'open');
    } finally {
      isSubmittingRef.current = false;
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
    handleBackToCards,
    handleEditAttendance,
    openReportModal,
    validationIssues,
    setValidationIssues,
    overrideReason,
    setOverrideReason,
  };
}
