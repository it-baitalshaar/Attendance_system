import { useState } from 'react';
import Image from 'next/image';
import log from '@/app/assets/logo (1).webp';
import type { DepartmentTheme } from '@/app/constants/themes';
import { AlSaqiyaLogo } from '@/app/components/theme';

interface HomeHeaderProps {
  userDisplay: { name?: string; email?: string; id?: string } | null;
  theme: DepartmentTheme;
}

export function HomeHeader({ userDisplay, theme }: HomeHeaderProps) {
  const [logoError, setLogoError] = useState(false);
  const isSaqiya = theme.id === 'saqiya';
  const showSaqiyaImage = isSaqiya && theme.logoPath && !logoError;

  return (
    <>
      {isSaqiya && (
        <header className="w-full -mx-3 sm:-mx-4 mb-4 sm:mb-6">
          {/* Logo band: light background so blue diamond and dark banner stand out */}
          <div className="w-full bg-theme-white py-10 sm:py-12 px-4 sm:px-6 rounded-none shadow-sm border-b-2 border-theme-accent/10">
            <div className="max-w-2xl mx-auto flex flex-col items-center gap-6">
              {showSaqiyaImage ? (
                <div className="flex flex-col items-center justify-center min-h-[220px] sm:min-h-[280px] w-full">
                  <Image
                    src={theme.logoPath!}
                    alt={theme.brandName}
                    width={500}
                    height={300}
                    priority
                    className="object-contain h-[200px] sm:h-[260px] w-auto max-w-[400px] sm:max-w-[500px]"
                    onError={() => setLogoError(true)}
                  />
                </div>
              ) : (
                <div className="min-h-[220px] flex items-center justify-center">
                  <AlSaqiyaLogo className="h-28 sm:h-32 w-auto text-theme-primary [max-width:400px]" />
                </div>
              )}
              <span
                className="text-theme-accent/90 text-xs sm:text-sm font-medium tracking-[0.2em] uppercase"
                style={{ fontFamily: 'var(--font-heading-en)' }}
              >
                Attendance
              </span>
            </div>
          </div>
          {/* Accent bar: brand primary for visual anchor */}
          <div className="h-1.5 w-full bg-theme-primary" aria-hidden />
        </header>
      )}
      <div className="flex flex-col justify-center items-center w-full">
        {!isSaqiya && (
          <>
            <Image src={log} alt="Logo" width={120} height={37} priority />
            <h1 className="text-xl sm:text-2xl mt-4 mb-2 font-heading-en text-theme-accent">{theme.brandName}</h1>
            <h2 className="text-xl sm:text-2xl text-theme-accent mt-2 text-center font-heading-en">Welcome</h2>
          </>
        )}
        {isSaqiya && (
          <h2
            className="text-xl sm:text-2xl text-theme-accent mt-4 sm:mt-6 text-center font-medium"
            style={{ fontFamily: 'var(--font-heading-en)' }}
          >
            Welcome
          </h2>
        )}
      </div>
      {userDisplay && (
        <p className={`mt-3 sm:mt-4 font-medium text-sm sm:text-base text-center max-w-full break-words px-2 ${isSaqiya ? 'text-theme-accent' : 'text-gray-700'}`}>
          Logged in as: <span className="uppercase">{userDisplay.name}</span>
          {userDisplay.email && (
            <span className="text-gray-500 text-xs sm:text-sm ml-1 sm:ml-2 block sm:inline">({userDisplay.email})</span>
          )}
        </p>
      )}
    </>
  );
}
