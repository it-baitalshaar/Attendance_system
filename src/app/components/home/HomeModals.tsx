import { ReportData } from '../../types/home';

interface HomeModalsProps {
  confirmModal: 'idle' | 'open' | 'submitting';
  setConfirmModal: (v: 'idle' | 'open' | 'submitting') => void;
  selectedDate: string;
  selectedDepartment: string;
  employeeListLength: number;
  presentCount: number;
  absentCount: number;
  vacationCount: number;
  onConfirmSubmit: () => void;
  reportModal: boolean;
  reportData: ReportData | null;
  setReportModal: (v: boolean) => void;
}

export function HomeModals({
  confirmModal,
  setConfirmModal,
  selectedDate,
  selectedDepartment,
  employeeListLength,
  presentCount,
  absentCount,
  vacationCount,
  onConfirmSubmit,
  reportModal,
  reportData,
  setReportModal,
}: HomeModalsProps) {
  return (
    <>
      {confirmModal === 'open' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl p-4 sm:p-6 max-w-md w-full shadow-xl my-4">
            <h3 className="text-lg sm:text-xl font-semibold mb-4">Confirm submission</h3>
            <p className="text-gray-600 mb-2">Date: {selectedDate}</p>
            <p className="text-gray-600 mb-2">Department: {selectedDepartment}</p>
            <p className="text-gray-600 mb-2">Total employees: {employeeListLength}</p>
            <p className="text-green-600 mb-1">Present: {presentCount}</p>
            <p className="text-red-600 mb-1">Absent: {absentCount}</p>
            <p className="text-yellow-600 mb-4">Vacation: {vacationCount}</p>
            <div className="flex gap-3 justify-end flex-wrap">
              <button type="button" onClick={() => setConfirmModal('idle')} className="min-h-[44px] px-4 py-2 border rounded-lg touch-manipulation">Cancel</button>
              <button type="button" onClick={onConfirmSubmit} className="min-h-[44px] px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 touch-manipulation">Submit</button>
            </div>
          </div>
        </div>
      )}
      {confirmModal === 'submitting' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
            <p>Submitting…</p>
          </div>
        </div>
      )}
      {reportModal && reportData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl p-4 sm:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl my-4">
            <h3 className="text-lg sm:text-xl font-semibold mb-4">Today&apos;s Attendance Summary</h3>
            <p><strong>Date:</strong> {reportData.date}</p>
            <p><strong>Department:</strong> {reportData.department}</p>
            {reportData.submittedAt && <p><strong>Submission time:</strong> {new Date(reportData.submittedAt).toLocaleString()}</p>}
            <p className="text-green-600 mt-2">Present: {reportData.present}</p>
            <p className="text-red-600">Absent: {reportData.absent}</p>
            <p className="text-yellow-600">Vacation: {reportData.vacation}</p>
            {reportData.nonPresentList.length > 0 && (
              <>
                <p className="font-medium mt-4">Non-present employees:</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  {reportData.nonPresentList.map((item, i) => (
                    <li key={i}>{item.name} – {item.status}{item.notes && ` (${item.notes})`}</li>
                  ))}
                </ul>
              </>
            )}
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => setReportModal(false)} className="min-h-[44px] px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 touch-manipulation">Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
