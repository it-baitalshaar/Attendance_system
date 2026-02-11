'use client';

import { AdminHeader } from './components/AdminHeader';
import { AdminTabsNav } from './components/AdminTabsNav';
import { EmployeesTab } from './components/EmployeesTab';
import { AttendanceTab } from './components/AttendanceTab';
import { ReportsTab } from './components/ReportsTab';
import { ProfileTab } from './components/ProfileTab';
import { useEmployeeManagement } from './hooks/useEmployeeManagement';
import { useAttendanceDashboard } from './hooks/useAttendanceDashboard';
import { useLeaveReportDashboard } from './hooks/useLeaveReportDashboard';
import { useAdminAuth } from './hooks/useAdminAuth';

export default function AdminPage() {
  const {
    checkingAuth,
    activeTab,
    setActiveTab,
    userProfile,
    passwordData,
    passwordMessage,
    passwordLoading,
    handleLogout,
    handlePasswordInputChange,
    handlePasswordChange,
  } = useAdminAuth();

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

      <AdminTabsNav activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'employees' && (
        <EmployeesTab
          employees={employees}
          newEmployee={newEmployee}
          loading={employeesLoading}
          message={employeesMessage}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
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

