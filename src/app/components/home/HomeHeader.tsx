import Image from 'next/image';
import log from '@/app/assets/logo (1).webp';

interface HomeHeaderProps {
  userDisplay: { name?: string; email?: string; id?: string } | null;
}

export function HomeHeader({ userDisplay }: HomeHeaderProps) {
  return (
    <>
      <div className="flex flex-col justify-center items-center">
        <Image src={log} alt="Logo" width={120} height={37} priority />
        <h1 className="text-xl sm:text-2xl mt-4 mb-2">Bait Alshaar</h1>
        <h1 className="text-xl sm:text-2xl text-black mt-2 text-center">Welcome</h1>
      </div>
      {userDisplay && (
        <p className="mt-4 text-gray-700 font-medium text-sm sm:text-base text-center max-w-full break-words px-2">
          Logged in as: <span className="uppercase">{userDisplay.name}</span>
          {userDisplay.email && (
            <span className="text-gray-500 text-xs sm:text-sm ml-1 sm:ml-2 block sm:inline">({userDisplay.email})</span>
          )}
        </p>
      )}
    </>
  );
}
