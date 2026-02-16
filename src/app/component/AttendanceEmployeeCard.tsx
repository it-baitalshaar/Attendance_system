'use client';

import React, { useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/redux/store';
import { setAttendanceEntry, setAttendanceNotes, type AttendanceStatus } from '@/redux/slice';

const ATTENDANCE_TYPE_PREFIX = 'Attendance type: ';
const PROJECTS_PREFIX = 'Projects: ';

function parseNotes(notes: string | null): { attendanceType: string; projectsText: string; userNote: string } {
  if (!notes || !notes.trim()) {
    return { attendanceType: 'Present', projectsText: '', userNote: '' };
  }
  const lines = notes.split('\n').map((l) => l.trim());
  let attendanceType = 'Present';
  let projectsText = '';
  let userNoteStart = 0;

  if (lines[0]?.startsWith(ATTENDANCE_TYPE_PREFIX)) {
    attendanceType = lines[0].slice(ATTENDANCE_TYPE_PREFIX.length).trim() || 'Present';
    userNoteStart = 1;
  }
  if (lines[userNoteStart]?.startsWith(PROJECTS_PREFIX)) {
    projectsText = lines[userNoteStart].slice(PROJECTS_PREFIX.length).trim();
    userNoteStart += 1;
  }
  const userNote = lines.slice(userNoteStart).join('\n').trim();
  return { attendanceType, projectsText, userNote };
}

function formatNotes(attendanceType: string, projectsText: string, userNote: string): string | null {
  const parts: string[] = [];
  if (attendanceType && attendanceType !== 'Present') parts.push(ATTENDANCE_TYPE_PREFIX + attendanceType);
  if (projectsText) parts.push(PROJECTS_PREFIX + projectsText);
  if (userNote) parts.push(userNote);
  return parts.length ? parts.join('\n') : null;
}

interface Employee {
  employee_id: string;
  name: string;
  position?: string;
}

interface AttendanceEmployeeCardProps {
  employee: Employee;
  disabled?: boolean;
  /** When 'customize' (Construction), show attendance type dropdown when Present. */
  variant?: 'standard' | 'customize';
  themeId?: 'default' | 'saqiya';
}

const statusOptions: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: 'present', label: 'Present', color: 'bg-green-600' },
  { value: 'absent', label: 'Absent', color: 'bg-red-600' },
  { value: 'vacation', label: 'Vacation', color: 'bg-yellow-500' },
];

const attendanceTypeOptions = [
  { value: 'Present', label: 'Present' },
  { value: 'Half Day', label: 'Half Day' },
  { value: 'Weekend', label: 'Weekend' },
  { value: 'Holiday-Work', label: 'Holiday' },
];

export default function AttendanceEmployeeCard({ employee, disabled, variant = 'standard', themeId }: AttendanceEmployeeCardProps) {
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [projectsExpanded, setProjectsExpanded] = useState(false);
  const dispatch = useDispatch();
  const entry = useSelector((state: RootState) =>
    state.project.attendanceEntries[employee.employee_id]
  );
  const status = entry?.status ?? 'present';
  const notes = entry?.notes ?? '';

  const { attendanceType, projectsText, userNote } = useMemo(() => parseNotes(notes), [notes]);

  const handleStatusChange = (value: AttendanceStatus) => {
    if (disabled) return;
    dispatch(setAttendanceEntry({ employee_id: employee.employee_id, status: value }));
  };

  const handleAttendanceTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (disabled) return;
    const value = e.target.value;
    const newNotes = formatNotes(value, projectsText, userNote);
    dispatch(setAttendanceNotes({ employee_id: employee.employee_id, notes: newNotes }));
  };

  const handleStandardAttendanceType = (type: 'Present' | 'Weekend') => {
    if (disabled) return;
    const newNotes = formatNotes(type, projectsText, userNote);
    dispatch(setAttendanceNotes({ employee_id: employee.employee_id, notes: newNotes }));
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value.trim() || '';
    const newNotes = formatNotes(attendanceType, projectsText, v);
    dispatch(setAttendanceNotes({ employee_id: employee.employee_id, notes: newNotes }));
  };

  const handleProjectsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value.trim() || '';
    const newNotes = formatNotes(attendanceType, v, userNote);
    dispatch(setAttendanceNotes({ employee_id: employee.employee_id, notes: newNotes }));
  };

  const displayNotePreview = userNote || projectsText || (attendanceType && attendanceType !== 'Present' ? attendanceType : '');
  const statusColor = statusOptions.find((o) => o.value === status)?.color ?? 'bg-gray-500';
  const isSaqiya = themeId === 'saqiya';
  const cardClass = isSaqiya
    ? 'p-3 sm:p-4 w-full min-w-0 max-w-[23rem] mx-auto rounded-theme-card border-2 border-theme-accent bg-theme-card-bg flex flex-col items-center shadow-sm'
    : 'p-3 sm:p-4 w-full min-w-0 max-w-[23rem] mx-auto rounded-lg shadow-md bg-[#710D15] flex flex-col items-center';
  /* Selected state: dark ring on Saqiya (white card), white ring on default (dark card) so it's always visible */
  const selectedRing = isSaqiya
    ? 'ring-4 ring-theme-accent ring-offset-2 ring-offset-theme-card-bg'
    : 'ring-4 ring-white ring-offset-2 ring-offset-[#710D15]';

  return (
    <div className={`${cardClass} ${disabled ? 'pointer-events-none opacity-70' : ''}`}>
      <h2 className={`text-lg sm:text-xl font-semibold mb-2 ${isSaqiya ? 'text-theme-primary' : 'text-[#D94853]'}`}>الحضور</h2>
      <p className={`px-2 my-2 text-lg sm:text-2xl text-center break-words ${isSaqiya ? 'text-theme-accent' : 'text-white'}`}>{employee.name}</p>
      <hr className={`h-px w-full max-w-[15.26rem] my-2 ${isSaqiya ? 'bg-theme-accent/20' : 'bg-white/30'}`} />

      <div className="w-full space-y-3">
        <label className={`block text-sm font-medium ${isSaqiya ? 'text-theme-accent' : 'text-white'}`}>Status</label>
        <div className="flex flex-wrap gap-2 justify-center">
          {statusOptions.map((opt) => {
            const isSelected = status === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => handleStatusChange(opt.value)}
                aria-pressed={isSelected}
                className={`min-h-[44px] min-w-[72px] px-3 sm:px-4 py-2.5 rounded-theme-card text-white text-sm sm:text-base font-medium transition touch-manipulation ${opt.color} ${
                  isSelected ? selectedRing : 'opacity-60 hover:opacity-80 active:opacity-100'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {isSelected && <span className="text-white drop-shadow-sm" aria-hidden>✓</span>}
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>

        {variant === 'standard' && status === 'present' && (
          <>
            <div className="w-full space-y-1.5">
              <label className={`block text-sm font-medium ${isSaqiya ? 'text-theme-accent' : 'text-white'}`}>Attendance type</label>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleStandardAttendanceType(attendanceType === 'Weekend' ? 'Present' : 'Weekend')}
                  aria-pressed={attendanceType === 'Weekend'}
                  className={`min-h-[40px] px-3 py-2 rounded-theme-card text-white text-sm font-medium touch-manipulation ${
                    attendanceType === 'Weekend' ? `bg-blue-600 ${selectedRing}` : 'bg-blue-600/60 hover:bg-blue-600/80'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {attendanceType === 'Weekend' && <span className="text-white drop-shadow-sm" aria-hidden>✓</span>}
                    Weekend
                  </span>
                </button>
              </div>
            </div>
            <div className="w-full space-y-1.5">
          <button
            type="button"
            onClick={() => setProjectsExpanded((p) => !p)}
            className={`text-sm underline min-h-[44px] inline-flex items-center touch-manipulation ${isSaqiya ? 'text-theme-primary' : 'text-white/90'}`}
          >
                {projectsExpanded ? 'Hide projects' : projectsText ? `Projects: ${projectsText.slice(0, 25)}${projectsText.length > 25 ? '…' : ''}` : 'Add projects'}
              </button>
              {projectsExpanded && (
                <textarea
                  placeholder="e.g. Project A 4h; Project B 4h"
                  value={projectsText}
                  onChange={handleProjectsChange}
                  disabled={disabled}
                  className="w-full text-black p-2 border rounded-lg min-h-[60px] text-base"
                  rows={2}
                />
              )}
            </div>
          </>
        )}

        {variant === 'customize' && status === 'present' && (
          <div className="w-full space-y-1.5">
            <label className="block text-white text-sm font-medium">Attendance type</label>
            <select
              value={attendanceType}
              onChange={handleAttendanceTypeChange}
              disabled={disabled}
              className="w-full text-black px-3 py-2.5 rounded-lg border min-h-[44px] touch-manipulation bg-white"
            >
              {attendanceTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-3">
          <button
            type="button"
            onClick={() => setNotesExpanded((e) => !e)}
            className={`text-sm underline min-h-[44px] inline-flex items-center touch-manipulation ${isSaqiya ? 'text-theme-primary' : 'text-white/90'}`}
          >
            {notesExpanded ? 'Hide note' : displayNotePreview ? `Note: ${displayNotePreview.slice(0, 30)}${displayNotePreview.length > 30 ? '…' : ''}` : 'Add note'}
          </button>
          {notesExpanded && (
            <textarea
              placeholder="Optional note"
              value={userNote}
              onChange={handleNotesChange}
              disabled={disabled}
              className="mt-1 w-full text-black p-2 border rounded-lg min-h-[60px] text-base"
              rows={2}
            />
          )}
        </div>
      </div>
    </div>
  );
}
