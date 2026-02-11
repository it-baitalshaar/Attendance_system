'use client';

import { useHomeAuth } from './hooks/useHomeAuth';
import { useHomePageState } from './hooks/useHomePageState';
import { useHomeSubmit } from './hooks/useHomeSubmit';
import { HomeHeader } from './components/home/HomeHeader';
import { HomeDepartmentDate } from './components/home/HomeDepartmentDate';
import { HomeAttendanceBanner } from './components/home/HomeAttendanceBanner';
import { HomeEntryModeSection } from './components/home/HomeEntryModeSection';
import { HomeLockedBanner } from './components/home/HomeLockedBanner';
import { HomeEmployeeGrid } from './components/home/HomeEmployeeGrid';
import { HomeModals } from './components/home/HomeModals';

export default function Home() {
  const { userDisplay, userDepartment, handleLogout } = useHomeAuth();
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

  return (
    <main className="mt-4 sm:mt-8 flex flex-col items-center justify-center relative min-h-screen pb-12 px-3 sm:px-4">
      <button
        onClick={handleLogout}
        className="absolute top-0 right-2 sm:right-4 bg-red-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded text-sm sm:text-base hover:bg-red-700 touch-manipulation"
      >
        Logout
      </button>

      <div className="flex flex-col items-center justify-center w-full max-w-4xl">
        <HomeHeader userDisplay={userDisplay} />
        <HomeDepartmentDate
          selectedDepartment={state.selectedDepartment}
          userDepartment={userDepartment}
          selectedDate={state.selectedDate}
          setSelectedDate={state.setSelectedDate}
          setUserHasUnlocked={state.setUserHasUnlocked}
          DEPARTMENTS={state.DEPARTMENTS}
        />
        <HomeAttendanceBanner
          selectedDepartment={state.selectedDepartment}
          selectedDate={state.selectedDate}
          existingSubmission={state.existingSubmission}
          DEPARTMENTS={state.DEPARTMENTS}
        />
        <HomeEntryModeSection
          selectedDepartment={state.selectedDepartment}
          showEntryMode={state.showEntryMode}
          entryMode={state.entryMode}
          setEntryMode={state.setEntryMode}
          showOnlyExceptions={state.showOnlyExceptions}
          setShowOnlyExceptions={state.setShowOnlyExceptions}
        />
        <HomeLockedBanner
          existingSubmission={state.existingSubmission}
          cardsLocked={state.cardsLocked}
          onEditAttendance={submit.handleEditAttendance}
          onOpenReport={submit.openReportModal}
          selectedDepartment={state.selectedDepartment}
          onOpenReportOnly={submit.openReportModal}
        />
        {state.editMode && !state.cardsLocked && (
          <p className="mt-2 text-amber-700 text-sm">You are editing an already submitted attendance.</p>
        )}
        <HomeEmployeeGrid
          loading={state.loading}
          displayList={state.displayList}
          showEntryMode={state.showEntryMode}
          entryMode={state.entryMode}
          attendanceEntries={state.attendanceEntries}
          cardsLocked={state.cardsLocked}
        />
        {state.selectedDepartment && state.employeeList.length > 0 && (
          <div className="mt-6 sm:mt-8 w-full flex justify-center">
            <button
              type="button"
              onClick={submit.handleSubmitClick}
              disabled={state.cardsLocked}
              className="w-full sm:w-auto min-h-[48px] px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 touch-manipulation"
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
