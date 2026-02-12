import Link from 'next/link';

type AdminTab = 'employees' | 'departments' | 'users' | 'attendance' | 'reports' | 'reminders' | 'profile';

interface AdminTabsNavProps {
  activeTab?: AdminTab;
  onTabChange?: (tab: AdminTab) => void;
  isSuperUser?: boolean;
  /** When set, tabs link to /admin?tab=X instead of using onTabChange (for use on subpages) */
  useLinks?: boolean;
}

export function AdminTabsNav({ activeTab = 'employees', onTabChange, isSuperUser, useLinks }: AdminTabsNavProps) {
  const tabClass = (tab: AdminTab) =>
    activeTab === tab
      ? 'border-b-2 border-blue-500 font-medium'
      : 'text-gray-500';

  const Tab = ({ tab, label }: { tab: AdminTab; label: string }) =>
    useLinks ? (
      <Link
        href={`/admin?tab=${tab}`}
        className={`px-4 py-2 mr-2 ${tabClass(tab)}`}
      >
        {label}
      </Link>
    ) : (
      <button
        className={`px-4 py-2 mr-2 ${tabClass(tab)}`}
        onClick={() => onTabChange?.(tab)}
      >
        {label}
      </button>
    );

  return (
    <div className="flex border-b mb-6 flex-wrap gap-1">
      <Tab tab="employees" label="Manage Employees" />
      <Tab tab="departments" label="Manage Departments" />
      {isSuperUser && <Tab tab="users" label="Manage Users" />}
      <Tab tab="attendance" label="Attendance Records" />
      <Tab tab="reports" label="Reports" />
      <Tab tab="reminders" label="Attendance Reminders" />
      <Tab tab="profile" label="My Profile" />
    </div>
  );
}

