import type { DepartmentTheme } from '@/app/constants/themes';

interface HomeEntryModeSectionProps {
  selectedDepartment: string;
  showEntryMode: boolean;
  entryMode: 'standard' | 'customize';
  setEntryMode: (v: 'standard' | 'customize') => void;
  showOnlyExceptions: boolean;
  setShowOnlyExceptions: (v: boolean) => void;
  theme?: DepartmentTheme;
}

export function HomeEntryModeSection({
  selectedDepartment,
  showEntryMode,
  entryMode,
  setEntryMode,
  showOnlyExceptions,
  setShowOnlyExceptions,
  theme,
}: HomeEntryModeSectionProps) {
  const isSaqiya = theme?.id === 'saqiya';
  if (!selectedDepartment) return null;
  return (
    <>
      <p className={`mt-4 text-sm italic text-center sm:text-left ${isSaqiya ? 'text-theme-accent' : 'text-gray-600'}`}>
        All employees are marked Present by default. Change only exceptions.
      </p>
      {showEntryMode && (
        <div className="mt-4 w-full max-w-md mx-auto sm:mx-0">
          <p className={`font-medium text-sm mb-2 text-center sm:text-left ${isSaqiya ? 'text-theme-accent' : 'text-black'}`}>Entry mode</p>
          <div className={`flex overflow-hidden p-1 ${isSaqiya ? 'rounded-theme-card border-2 border-theme-accent bg-theme-subtle' : 'rounded-xl border border-gray-300 bg-gray-100 shadow-sm'}`}>
            <button
              type="button"
              onClick={() => setEntryMode('standard')}
              className={`flex-1 min-h-[44px] py-2.5 px-4 text-sm font-medium transition touch-manipulation ${
                isSaqiya
                  ? entryMode === 'standard'
                    ? 'bg-theme-primary text-theme-white'
                    : 'text-theme-accent hover:bg-theme-subtle'
                  : entryMode === 'standard'
                    ? 'rounded-lg bg-white text-[#710D15] shadow'
                    : 'rounded-lg text-gray-600 hover:text-gray-900'
              } ${isSaqiya && entryMode === 'standard' ? 'rounded-theme-card' : ''} ${isSaqiya && entryMode !== 'standard' ? 'rounded-theme-card' : ''}`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setEntryMode('customize')}
              className={`flex-1 min-h-[44px] py-2.5 px-4 text-sm font-medium transition touch-manipulation ${
                isSaqiya
                  ? entryMode === 'customize'
                    ? 'bg-theme-primary text-theme-white'
                    : 'text-theme-accent hover:bg-theme-subtle'
                  : entryMode === 'customize'
                    ? 'rounded-lg bg-white text-[#710D15] shadow'
                    : 'rounded-lg text-gray-600 hover:text-gray-900'
              } ${isSaqiya ? 'rounded-theme-card' : 'rounded-lg'}`}
            >
              Customize
            </button>
          </div>
          <p className={`mt-1.5 text-xs text-center sm:text-left ${isSaqiya ? 'text-theme-accent/80' : 'text-gray-500'}`}>
            {entryMode === 'standard' ? 'Quick: Present, Absent, or Vacation only.' : 'Detailed: add attendance type (e.g. Half Day, Weekend) when Present.'}
          </p>
        </div>
      )}
      <label className={`mt-4 flex items-center gap-2 ${isSaqiya ? 'text-theme-accent' : 'text-black'}`}>
        <input type="checkbox" checked={showOnlyExceptions} onChange={(e) => setShowOnlyExceptions(e.target.checked)} />
        Show only Absent / Vacation
      </label>
    </>
  );
}
