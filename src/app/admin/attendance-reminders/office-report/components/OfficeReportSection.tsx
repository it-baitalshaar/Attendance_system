'use client';

import type { OfficeReportDepartmentKey } from '../types';
import type { OfficeReportSetting, OfficeReportEmailRow } from '../types';
import { formatTime } from '../../utils';
import { OFFICE_REPORT_DEPARTMENTS } from '../constants';

interface OfficeReportSectionProps {
  settings: OfficeReportSetting[];
  emailsByDept: Record<OfficeReportDepartmentKey, OfficeReportEmailRow[]>;
  timeByDept: Record<OfficeReportDepartmentKey, string>;
  toggling: OfficeReportDepartmentKey | null;
  testingDept: OfficeReportDepartmentKey | null;
  testStatusByDept: Record<OfficeReportDepartmentKey, string>;
  newEmail: Record<OfficeReportDepartmentKey, string>;
  errorByDept: Record<OfficeReportDepartmentKey, string>;
  onToggle: (d: OfficeReportDepartmentKey) => void;
  onTimeChange: (d: OfficeReportDepartmentKey, value: string) => void;
  onNewEmailChange: (d: OfficeReportDepartmentKey, value: string) => void;
  onClearError: (d: OfficeReportDepartmentKey) => void;
  onAddEmail: (d: OfficeReportDepartmentKey) => void;
  onDeleteEmail: (id: string) => void;
  onTestSend: (d: OfficeReportDepartmentKey) => void;
}

export function OfficeReportSection({
  settings,
  emailsByDept,
  timeByDept,
  toggling,
  testingDept,
  testStatusByDept,
  newEmail,
  errorByDept,
  onToggle,
  onTimeChange,
  onNewEmailChange,
  onClearError,
  onAddEmail,
  onDeleteEmail,
  onTestSend,
}: OfficeReportSectionProps) {
  return (
    <section className="mb-8 p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-2">Office Daily Report (10 AM)</h2>
      <p className="text-gray-600 mb-6">
        Daily email at 10:00 AM with today&apos;s check-in/check-out and monthly total hours for Office Baitalshaar and Alsaqia Showroom.
      </p>
      <div className="space-y-6">
        {OFFICE_REPORT_DEPARTMENTS.map(({ value, label }) => {
          const row = settings.find((s) => s.department === value);
          const isOn = row?.enabled ?? false;
          const isToggling = toggling === value;
          return (
            <div key={value} className="p-4 rounded-lg border border-gray-200 bg-gray-50/50">
              <div className="flex items-center justify-between py-2 border-b border-gray-200 mb-4">
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{label}</span>
                  {row && (
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                      <span>Report time:</span>
                      <input
                        type="time"
                        value={timeByDept[value]}
                        onChange={(e) => onTimeChange(value, e.target.value)}
                        className="border rounded px-2 py-1 text-sm"
                      />
                      <span className="text-gray-400">({formatTime(row.report_time)})</span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onToggle(value)}
                  disabled={isToggling || !row}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                    isOn ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                      isOn ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-3">
                Recipients receive a daily report with check-in times and monthly total hours.
              </p>
              <ul className="space-y-2 mb-4">
                {emailsByDept[value].length === 0 ? (
                  <li className="text-gray-500 text-sm">No emails added yet.</li>
                ) : (
                  emailsByDept[value].map((emailRow) => (
                    <li key={emailRow.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-white border border-gray-100">
                      <span className="text-sm">{emailRow.email}</span>
                      <button
                        type="button"
                        onClick={() => onDeleteEmail(emailRow.id)}
                        className="text-red-600 hover:underline text-sm"
                      >
                        Delete
                      </button>
                    </li>
                  ))
                )}
              </ul>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="email"
                  value={newEmail[value]}
                  onChange={(e) => {
                    onNewEmailChange(value, e.target.value);
                    onClearError(value);
                  }}
                  placeholder="email@company.com"
                  className="border rounded px-3 py-2 w-64 max-w-full"
                />
                <button
                  type="button"
                  onClick={() => onAddEmail(value)}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  + Add Email
                </button>
              </div>
              {errorByDept[value] && <p className="text-red-500 text-sm mt-1">{errorByDept[value]}</p>}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onTestSend(value)}
                  disabled={testingDept === value}
                  className="text-sm px-3 py-1.5 rounded border border-blue-600 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                >
                  {testingDept === value ? 'Sending…' : 'Send test report now'}
                </button>
                {testStatusByDept[value] && <p className="text-xs text-gray-600">{testStatusByDept[value]}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
