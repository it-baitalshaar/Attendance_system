interface HomeEntryModeSectionProps {
  selectedDepartment: string;
  showEntryMode: boolean;
  entryMode: 'standard' | 'customize';
  setEntryMode: (v: 'standard' | 'customize') => void;
  showOnlyExceptions: boolean;
  setShowOnlyExceptions: (v: boolean) => void;
}

export function HomeEntryModeSection({
  selectedDepartment,
  showEntryMode,
  entryMode,
  setEntryMode,
  showOnlyExceptions,
  setShowOnlyExceptions,
}: HomeEntryModeSectionProps) {
  if (!selectedDepartment) return null;
  return (
    <>
      <p className="mt-4 text-gray-600 text-sm italic text-center sm:text-left">
        All employees are marked Present by default. Change only exceptions.
      </p>
      {showEntryMode && (
        <div className="mt-4 w-full max-w-md mx-auto sm:mx-0">
          <p className="text-black font-medium text-sm mb-2 text-center sm:text-left">Entry mode</p>
          <div className="flex rounded-xl overflow-hidden border border-gray-300 bg-gray-100 p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setEntryMode('standard')}
              className={`flex-1 min-h-[44px] py-2.5 px-4 rounded-lg text-sm font-medium transition touch-manipulation ${
                entryMode === 'standard' ? 'bg-white text-[#710D15] shadow' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setEntryMode('customize')}
              className={`flex-1 min-h-[44px] py-2.5 px-4 rounded-lg text-sm font-medium transition touch-manipulation ${
                entryMode === 'customize' ? 'bg-white text-[#710D15] shadow' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Customize
            </button>
          </div>
          <p className="mt-1.5 text-gray-500 text-xs text-center sm:text-left">
            {entryMode === 'standard' ? 'Quick: Present, Absent, or Vacation only.' : 'Detailed: add attendance type (e.g. Half Day, Weekend) when Present.'}
          </p>
        </div>
      )}
      <label className="mt-4 flex items-center gap-2 text-black">
        <input type="checkbox" checked={showOnlyExceptions} onChange={(e) => setShowOnlyExceptions(e.target.checked)} />
        Show only Absent / Vacation
      </label>
    </>
  );
}
