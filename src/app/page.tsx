'use client';

import { useHomeAuth } from './hooks/useHomeAuth';
import { useHomePageState } from './hooks/useHomePageState';
import { useHomeSubmit } from './hooks/useHomeSubmit';
import { useDepartmentTheme } from './hooks/useDepartmentTheme';
import { HomeHeader } from './components/home/HomeHeader';
import { HomeDepartmentDate } from './components/home/HomeDepartmentDate';
import { HomeAttendanceBanner } from './components/home/HomeAttendanceBanner';
import { HomeEntryModeSection } from './components/home/HomeEntryModeSection';
import { HomeLockedBanner } from './components/home/HomeLockedBanner';
import { HomeEmployeeGrid } from './components/home/HomeEmployeeGrid';
import { HomeModals } from './components/home/HomeModals';
import { GeometricDivider } from './components/theme';

export default function Home() {
  const { userDisplay, userDepartment, handleLogout } = useHomeAuth();
  const theme = useDepartmentTheme(userDepartment);
  const state = useHomePageState();
  const submit = useHomeSubmit({
    employeeList: state.employeeList,
    selectedDepartment: state.selectedDepartment,
    departmentForFetch: state.departmentForFetch,
    selectedDate: state.selectedDate,
    employees: state.employees,
    attendanceEntries: state.attendanceEntries,
    getStatus: state.getStatus,
    presentCount: state.presentCount,
    absentCount: state.absentCount,
    vacationCount: state.vacationCount,
    showEntryMode: state.showEntryMode,
    entryMode: state.entryMode,
    setExistingSubmission: state.setExistingSubmission,
    setCardsLocked: state.setCardsLocked,
    setEditMode: state.setEditMode,
    setUserHasUnlocked: state.setUserHasUnlocked,
  });

  const isSaqiya = theme.id === 'saqiya';
  return (
    <main
      className={`${theme.themeClass} mt-0 sm:mt-0 flex flex-col items-center justify-center relative min-h-screen pb-12 px-3 sm:px-4 ${
        isSaqiya ? 'bg-theme-subtle' : ''
      }`}
    >
      <button
        onClick={handleLogout}
        className={`absolute top-2 right-2 sm:right-4 z-10 px-3 py-1.5 sm:px-4 sm:py-2 rounded-theme-card text-sm sm:text-base touch-manipulation ${
          isSaqiya
            ? 'bg-theme-accent text-theme-white hover:opacity-90'
            : 'bg-red-600 text-white hover:bg-red-700'
        }`}
      >
        Logout
      </button>

      <div className={`flex flex-col items-center justify-center w-full max-w-4xl ${isSaqiya ? 'gap-0' : ''}`}>
        <HomeHeader userDisplay={userDisplay} theme={theme} />
        {isSaqiya && (
          <>
            <GeometricDivider />
            <div className="w-full h-2 sm:h-3" aria-hidden />
          </>
        )}
        <HomeDepartmentDate
          selectedDepartment={state.selectedDepartment}
          userDepartment={userDepartment}
          selectedDate={state.selectedDate}
          setSelectedDate={state.setSelectedDate}
          setUserHasUnlocked={state.setUserHasUnlocked}
          DEPARTMENTS={state.DEPARTMENTS}
          theme={theme}
        />
        <HomeAttendanceBanner
          selectedDepartment={state.selectedDepartment}
          selectedDate={state.selectedDate}
          existingSubmission={state.existingSubmission}
          DEPARTMENTS={state.DEPARTMENTS}
          theme={theme}
        />
        <HomeEntryModeSection
          selectedDepartment={state.selectedDepartment}
          showEntryMode={state.showEntryMode}
          entryMode={state.entryMode}
          setEntryMode={state.setEntryMode}
          showOnlyExceptions={state.showOnlyExceptions}
          setShowOnlyExceptions={state.setShowOnlyExceptions}
          theme={theme}
        />
        <HomeLockedBanner
          existingSubmission={state.existingSubmission}
          cardsLocked={state.cardsLocked}
          onEditAttendance={submit.handleEditAttendance}
          onOpenReport={submit.openReportModal}
          selectedDepartment={state.selectedDepartment}
          onOpenReportOnly={submit.openReportModal}
          theme={theme}
        />
        {state.editMode && !state.cardsLocked && (
          <p className={`mt-2 text-sm ${isSaqiya ? 'text-theme-accent' : 'text-amber-700'}`}>
            You are editing an already submitted attendance.
          </p>
        )}
        <HomeEmployeeGrid
          loading={state.loading}
          displayList={state.displayList}
          showEntryMode={state.showEntryMode}
          entryMode={state.entryMode}
          attendanceEntries={state.attendanceEntries}
          cardsLocked={state.cardsLocked}
          theme={theme}
        />
        {state.selectedDepartment && state.employeeList.length > 0 && (
          <div className="mt-6 sm:mt-8 w-full flex justify-center">
            <button
              type="button"
              onClick={submit.handleSubmitClick}
              disabled={state.cardsLocked}
              className={`w-full sm:w-auto min-h-[48px] px-6 py-3 text-theme-white rounded-theme-card disabled:opacity-50 touch-manipulation font-medium ${
                isSaqiya
                  ? 'bg-theme-primary hover:opacity-90'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              Submit Attendance
            </button>
          </div>
        )}
      </div>

      <HomeModals
        confirmModal={submit.confirmModal}
        setConfirmModal={submit.setConfirmModal}
        selectedDate={state.selectedDate}
        selectedDepartment={state.selectedDepartment}
        employeeListLength={state.employeeList.length}
        presentCount={state.presentCount}
        absentCount={state.absentCount}
        vacationCount={state.vacationCount}
        onConfirmSubmit={submit.handleConfirmSubmit}
        reportModal={submit.reportModal}
        reportData={submit.reportData}
        setReportModal={submit.setReportModal}
      />
    </main>
  );
}
