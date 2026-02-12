'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminHeader } from './components/AdminHeader';
import { AdminTabsNav } from './components/AdminTabsNav';
import { EmployeesTab } from './components/EmployeesTab';
import { DepartmentsTab } from './components/DepartmentsTab';
import { UsersTab } from './components/UsersTab';
import { AttendanceTab } from './components/AttendanceTab';
import { ReportsTab } from './components/ReportsTab';
import { ProfileTab } from './components/ProfileTab';
import { RemindersTab } from './components/RemindersTab';
import { useEmployeeManagement } from './hooks/useEmployeeManagement';
import { useAttendanceDashboard } from './hooks/useAttendanceDashboard';
import { useLeaveReportDashboard } from './hooks/useLeaveReportDashboard';
import { useAdminAuth } from './hooks/useAdminAuth';
import { useUserManagement } from './hooks/useUserManagement';
import { useDepartmentManagement } from './hooks/useDepartmentManagement';

const VALID_TABS = ['employees', 'departments', 'users', 'attendance', 'reports', 'reminders', 'profile'] as const;

function AdminPageContent() {
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const initialTab = VALID_TABS.includes(tabFromUrl as any) ? (tabFromUrl as typeof VALID_TABS[number]) : 'employees';

  const {
    checkingAuth,
    activeTab,
    setActiveTab,
    currentUserId,
    isSuperUser,
    userProfile,
    passwordData,
    passwordMessage,
    passwordLoading,
    handleLogout,
    handlePasswordInputChange,
    handlePasswordChange,
  } = useAdminAuth(initialTab);

  useEffect(() => {
    if (!VALID_TABS.includes(tabFromUrl as any)) return;
    if (tabFromUrl === 'users' && !isSuperUser) return;
    if (tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl as typeof VALID_TABS[number]);
    }
  }, [tabFromUrl, activeTab, setActiveTab, isSuperUser]);

  const {
    employees,
    newEmployee,
    departments,
    loading: employeesLoading,
    message: employeesMessage,
    handleInputChange,
    handleSubmit,
  } = useEmployeeManagement();

  const {
    attendanceRecords,
    attendanceLoading,
    dateRange,
    selectedEmployeeId,
    selectedDepartment,
    selectedStatus,
    statusSummary,
    departmentWarnings,
    currentPage,
    totalPages,
    setSelectedEmployeeId,
    setSelectedDepartment,
    setSelectedStatus,
    handleDateChange,
    handlePageChange,
    fetchAttendanceRecords,
  } = useAttendanceDashboard(departments, activeTab);

  const {
    leaveReport,
    reportLoading,
    reportDateRange,
    handleReportDateChange,
    fetchLeaveReport,
  } = useLeaveReportDashboard(activeTab);

  const {
    users,
    loading: usersLoading,
    message: usersMessage,
    messageType: usersMessageType,
    roles,
    departments: userDepartments,
    updateProfile,
    updatePassword,
    deleteUser,
    addUser,
    setMessage: setUsersMessage,
  } = useUserManagement(isSuperUser);

  const {
    departments: dbDepartments,
    loading: departmentsLoading,
    message: departmentsMessage,
    messageType: departmentsMessageType,
    addDepartment,
    updateDepartment,
    deleteDepartment,
    setMessage: setDepartmentsMessage,
  } = useDepartmentManagement();

  useEffect(() => {
    if (!isSuperUser && activeTab === 'users') {
      setActiveTab('employees');
    }
  }, [isSuperUser, activeTab, setActiveTab]);

  if (checkingAuth) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent border-solid rounded-full animate-spin mx-auto"></div>
          <p className="mt-4">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <AdminHeader onLogout={handleLogout} />

      <AdminTabsNav activeTab={activeTab} onTabChange={setActiveTab} isSuperUser={isSuperUser} useLinks />

      {activeTab === 'employees' && (
        <EmployeesTab
          employees={employees}
          newEmployee={newEmployee}
          departments={dbDepartments.length > 0 ? dbDepartments.map((d) => d.name) : departments}
          loading={employeesLoading}
          message={employeesMessage}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
        />
      )}

      {activeTab === 'departments' && (
        <DepartmentsTab
          departments={dbDepartments}
          loading={departmentsLoading}
          message={departmentsMessage}
          messageType={departmentsMessageType}
          onAddDepartment={addDepartment}
          onUpdateDepartment={updateDepartment}
          onDeleteDepartment={deleteDepartment}
          onClearMessage={() => setDepartmentsMessage('')}
        />
      )}

      {activeTab === 'users' && isSuperUser && (
        <UsersTab
          users={users}
          loading={usersLoading}
          message={usersMessage}
          messageType={usersMessageType}
          roles={roles}
          departments={userDepartments}
          onUpdateProfile={updateProfile}
          onUpdatePassword={updatePassword}
          onDeleteUser={deleteUser}
          onAddUser={addUser}
          currentUserId={currentUserId}
          onClearMessage={() => setUsersMessage('')}
        />
      )}

      {activeTab === 'attendance' && (
        <AttendanceTab
          attendanceRecords={attendanceRecords}
          attendanceLoading={attendanceLoading}
          statusSummary={statusSummary}
          departmentWarnings={departmentWarnings}
          dateRange={dateRange}
          selectedEmployeeId={selectedEmployeeId}
          selectedDepartment={selectedDepartment}
          selectedStatus={selectedStatus}
          employees={employees}
          departments={departments}
          currentPage={currentPage}
          totalPages={totalPages}
          onDateChange={handleDateChange}
          onEmployeeChange={setSelectedEmployeeId}
          onDepartmentChange={setSelectedDepartment}
          onStatusChange={setSelectedStatus}
          onPageChange={handlePageChange}
          onApplyFilters={fetchAttendanceRecords}
        />
      )}

      {activeTab === 'reminders' && <RemindersTab />}

      {activeTab === 'reports' && (
        <ReportsTab
          leaveReport={leaveReport}
          reportLoading={reportLoading}
          reportDateRange={reportDateRange}
          onReportDateChange={handleReportDateChange}
          onGenerateReport={fetchLeaveReport}
        />
      )}

      {activeTab === 'profile' && (
        <ProfileTab
          userProfile={userProfile}
          passwordData={passwordData}
          passwordMessage={passwordMessage}
          passwordLoading={passwordLoading}
          onPasswordInputChange={handlePasswordInputChange}
          onPasswordChange={handlePasswordChange}
        />
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center h-screen">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AdminPageContent />
    </Suspense>
  );
}
