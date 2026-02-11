'use client';

import { useRemindersAuth } from './hooks/useRemindersAuth';
import { useRemindersData } from './hooks/useRemindersData';
import { RemindersHeader } from './components/RemindersHeader';
import { EnableSection } from './components/EnableSection';
import { EmailSection } from './components/EmailSection';
import type { DepartmentKey } from './types';

export default function AttendanceRemindersPage() {
  const { checkingAuth } = useRemindersAuth();
  const data = useRemindersData();

  if (checkingAuth) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <RemindersHeader />
      <p className="text-gray-600 mb-6">
        Control reminder emails for Construction (3:00 PM) and Maintenance (8:00 PM). Only listed emails receive reminders when attendance is not submitted for the day.
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
          <p className="mt-6 text-sm text-gray-500">
            ENV: {process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'TEST'}
          </p>
        </>
      )}
    </div>
  );
}
