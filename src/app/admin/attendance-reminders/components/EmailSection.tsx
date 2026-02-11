import type { DepartmentKey } from '../types';
import type { ReminderEmailRow } from '../types';
import { DEPARTMENTS } from '../constants';

interface EmailSectionProps {
  emailsByDept: Record<DepartmentKey, ReminderEmailRow[]>;
  newEmail: Record<DepartmentKey, string>;
  errorByDept: Record<DepartmentKey, string>;
  testingDept: DepartmentKey | null;
  testStatusByDept: Record<DepartmentKey, string>;
  onNewEmailChange: (dept: DepartmentKey, value: string) => void;
  onClearError: (dept: DepartmentKey) => void;
  onAddEmail: (dept: DepartmentKey) => void;
  onDeleteEmail: (id: string) => void;
  onTestSend: (dept: DepartmentKey) => void;
}

export function EmailSection({
  emailsByDept,
  newEmail,
  errorByDept,
  testingDept,
  testStatusByDept,
  onNewEmailChange,
  onClearError,
  onAddEmail,
  onDeleteEmail,
  onTestSend,
}: EmailSectionProps) {
  return (
    <section className="space-y-8">
      {DEPARTMENTS.map(({ value, label }) => (
        <div key={value} className="p-4 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-3">Reminder emails — {label}</h2>
          <p className="text-sm text-gray-600 mb-4">
            These addresses receive a reminder if attendance is not submitted by the reminder time.
          </p>
          <ul className="space-y-2 mb-4">
            {emailsByDept[value].length === 0 ? (
              <li className="text-gray-500 text-sm">No emails added yet.</li>
            ) : (
              emailsByDept[value].map((row) => (
                <li key={row.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-gray-50">
                  <span className="text-sm">{row.email}</span>
                  <button
                    type="button"
                    onClick={() => onDeleteEmail(row.id)}
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
          <div className="mt-4 flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onTestSend(value)}
                disabled={testingDept === value}
                className="text-sm px-3 py-1.5 rounded border border-blue-600 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
              >
                {testingDept === value ? 'Sending…' : 'Send test reminder now'}
              </button>
              <p className="text-xs text-gray-500">
                Uses the same rules as CRON: only sends if reminders are enabled, today&apos;s attendance is missing, and there are recipients.
              </p>
            </div>
            {testStatusByDept[value] && <p className="text-xs text-gray-600">{testStatusByDept[value]}</p>}
          </div>
        </div>
      ))}
    </section>
  );
}
