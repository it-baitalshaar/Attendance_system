import Link from 'next/link';

export function RemindersHeader() {
  return (
    <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-blue-600 hover:underline">
          ← Admin Dashboard
        </Link>
        <h1 className="text-2xl font-bold">Attendance Reminder Settings</h1>
      </div>
    </div>
  );
}
