'use client';

import { useRemindersData } from '../attendance-reminders/hooks/useRemindersData';
import { EnableSection } from '../attendance-reminders/components/EnableSection';
import { EmailSection } from '../attendance-reminders/components/EmailSection';
import type { DepartmentKey } from '../attendance-reminders/types';

export function RemindersTab() {
  const data = useRemindersData();

  return (
    <div className="max-w-4xl">
      <h2 className="text-xl font-semibold mb-2">Attendance Reminder Settings</h2>
      <p className="text-gray-600 mb-6">
        Control reminder emails for Construction (3:00 PM) and Maintenance (8:00 PM).
        Only listed emails receive reminders when attendance is not submitted for the day.
      </p>
      {data.loading ? (
        <p className="text-center py-8">Loading...</p>
      ) : (
        <>
          <EnableSection
            settings={data.settings}
            timeByDept={data.timeByDept}
            toggling={data.toggling}
            onToggle={data.handleToggle}
            onTimeChange={data.handleTimeChange}
          />
          <EmailSection
            emailsByDept={data.emailsByDept}
            newEmail={data.newEmail}
            errorByDept={data.errorByDept}
            testingDept={data.testingDept}
            testStatusByDept={data.testStatusByDept}
            onNewEmailChange={(dept: DepartmentKey, value: string) =>
              data.setNewEmail((prev) => ({ ...prev, [dept]: value }))
            }
            onClearError={(dept: DepartmentKey) =>
              data.setErrorByDept((prev) => ({ ...prev, [dept]: '' }))
            }
            onAddEmail={data.handleAddEmail}
            onDeleteEmail={data.handleDeleteEmail}
            onTestSend={data.handleTestSend}
          />
        </>
      )}
    </div>
  );
}
