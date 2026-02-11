import type { DepartmentKey } from '../types';
import type { ReminderSetting } from '../types';
import { formatTime } from '../utils';
import { DEPARTMENTS } from '../constants';

interface EnableSectionProps {
  settings: ReminderSetting[];
  timeByDept: Record<DepartmentKey, string>;
  toggling: DepartmentKey | null;
  onToggle: (d: DepartmentKey) => void;
  onTimeChange: (d: DepartmentKey, value: string) => void;
}

export function EnableSection({
  settings,
  timeByDept,
  toggling,
  onToggle,
  onTimeChange,
}: EnableSectionProps) {
  return (
    <section className="mb-8 p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Enable / Disable Reminders</h2>
      <div className="space-y-4">
        {DEPARTMENTS.map(({ value, label }) => {
          const row = settings.find((s) => s.department === value);
          const isOn = row?.enabled ?? false;
          const isToggling = toggling === value;
          return (
            <div
              key={value}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
            >
              <div className="flex flex-col gap-1">
                <span className="font-medium">{label}</span>
                {row && (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                    <span>Reminder time:</span>
                    <input
                      type="time"
                      value={timeByDept[value]}
                      onChange={(e) => onTimeChange(value, e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                    />
                    <span className="text-gray-400">({formatTime(row.reminder_time)})</span>
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
          );
        })}
      </div>
      <p className="text-sm text-gray-500 mt-2">
        If OFF, no reminder emails are sent for that department even when attendance is missing.
      </p>
    </section>
  );
}
