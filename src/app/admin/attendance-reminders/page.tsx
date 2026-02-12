'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Redirect old /admin/attendance-reminders links to the reminders tab on the main admin page. */
export default function AttendanceRemindersRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin?tab=reminders');
  }, [router]);

  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-4">Redirecting to Attendance Reminders...</p>
      </div>
    </div>
  );
}
