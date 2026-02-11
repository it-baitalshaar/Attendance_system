interface AdminHeaderProps {
  onLogout: () => void;
}

export function AdminHeader({ onLogout }: AdminHeaderProps) {
  return (
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <button
        onClick={onLogout}
        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
      >
        Logout
      </button>
    </div>
  );
}

