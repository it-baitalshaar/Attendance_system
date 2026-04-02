'use client';

import Link from 'next/link';
import { useOfficeReportData } from '../attendance-reminders/office-report/hooks/useOfficeReportData';
import { OfficeReportSection } from '../attendance-reminders/office-report/components/OfficeReportSection';
import type { OfficeReportDepartmentKey } from '../attendance-reminders/office-report/types';

export function OfficeReportSettingsTab() {
  const officeData = useOfficeReportData();

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Office Report Settings</h2>
        <p className="mt-1 text-gray-600">
          Manage daily report emails and recipients for Bait Alshaar and Al Saqia.
        </p>
      </div>

      <section className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">What this report includes</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Daily check-in and check-out times for each employee</li>
          <li>Today’s worked hours</li>
          <li>Monthly total hours (current month)</li>
        </ul>
        <p className="mt-2 text-sm text-blue-700">
          Reports are sent via Supabase Edge Functions (same pipeline as attendance reminders). Assign employees to
          departments in{' '}
          <Link href="/admin?tab=officeEmployees" className="underline font-medium hover:text-blue-900">
            Office Employees
          </Link>
          .
        </p>
      </section>

      {officeData.loading ? (
        <div className="py-12 text-center">
          <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="mt-3 text-gray-500">Loading settings…</p>
        </div>
      ) : (
        <OfficeReportSection
          settings={officeData.settings}
          emailsByDept={officeData.emailsByDept}
          timeByDept={officeData.timeByDept}
          dateByDept={officeData.dateByDept}
          monthByDept={officeData.monthByDept}
          toggling={officeData.toggling}
          testingDept={officeData.testingDept}
          testStatusByDept={officeData.testStatusByDept}
          newEmail={officeData.newEmail}
          errorByDept={officeData.errorByDept}
          onToggle={officeData.handleToggle}
          onTimeChange={officeData.handleTimeChange}
          onDateChange={officeData.handleDateChange}
          onMonthChange={officeData.handleMonthChange}
          onNewEmailChange={(dept: OfficeReportDepartmentKey, value: string) =>
            officeData.setNewEmail((prev) => ({ ...prev, [dept]: value }))
          }
          onClearError={(dept: OfficeReportDepartmentKey) =>
            officeData.setErrorByDept((prev) => ({ ...prev, [dept]: '' }))
          }
          onAddEmail={officeData.handleAddEmail}
          onDeleteEmail={officeData.handleDeleteEmail}
          onTestSend={officeData.handleTestSend}
        />
      )}

      <section className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
        <h3 className="font-semibold text-gray-800 mb-2">Scheduled sending</h3>
        <p>
          To send this report automatically every day, use Supabase cron or an external scheduler to call the{' '}
          <code className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">send-office-daily-report</code> Edge Function
          (same as the test button above). Times and recipients are controlled by the settings on this page.
        </p>
      </section>
    </div>
  );
}
