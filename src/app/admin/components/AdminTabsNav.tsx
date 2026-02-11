type AdminTab = 'employees' | 'attendance' | 'reports' | 'profile';

interface AdminTabsNavProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}

export function AdminTabsNav({ activeTab, onTabChange }: AdminTabsNavProps) {
  return (
    <div className="flex border-b mb-6 flex-wrap gap-1">
      <button
        className={`px-4 py-2 mr-2 ${
          activeTab === 'employees'
            ? 'border-b-2 border-blue-500 font-medium'
            : 'text-gray-500'
        }`}
        onClick={() => onTabChange('employees')}
      >
        Manage Employees
      </button>
      <button
        className={`px-4 py-2 mr-2 ${
          activeTab === 'attendance'
            ? 'border-b-2 border-blue-500 font-medium'
            : 'text-gray-500'
        }`}
        onClick={() => onTabChange('attendance')}
      >
        Attendance Records
      </button>
      <button
        className={`px-4 py-2 mr-2 ${
          activeTab === 'reports'
            ? 'border-b-2 border-blue-500 font-medium'
            : 'text-gray-500'
        }`}
        onClick={() => onTabChange('reports')}
      >
        Reports
      </button>
      <a
        href="/admin/attendance-reminders"
        className="px-4 py-2 mr-2 text-blue-600 hover:underline"
      >
        Attendance Reminders
      </a>
      <button
        className={`px-4 py-2 ${
          activeTab === 'profile'
            ? 'border-b-2 border-blue-500 font-medium'
            : 'text-gray-500'
        }`}
        onClick={() => onTabChange('profile')}
      >
        My Profile
      </button>
    </div>
  );
}

