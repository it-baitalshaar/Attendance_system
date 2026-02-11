import { PasswordData, UserProfile } from '../services/profileService';

interface ProfileTabProps {
  userProfile: UserProfile;
  passwordData: PasswordData;
  passwordMessage: string;
  passwordLoading: boolean;
  onPasswordInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPasswordChange: (e: React.FormEvent) => void;
}

export function ProfileTab({
  userProfile,
  passwordData,
  passwordMessage,
  passwordLoading,
  onPasswordInputChange,
  onPasswordChange,
}: ProfileTabProps) {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h2 className="text-xl font-semibold mb-4">My Profile</h2>

        <div className="mb-8">
          <div className="mb-4">
            <h3 className="text-lg font-medium">Account Information</h3>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="block text-sm font-medium text-gray-700">
                  Email:
                </span>
                <span className="block mt-1">{userProfile.email}</span>
              </div>
              <div>
                <span className="block text-sm font-medium text-gray-700">
                  Role:
                </span>
                <span className="block mt-1 capitalize">
                  {userProfile.role}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-4">Change Password</h3>
          <form onSubmit={onPasswordChange} className="max-w-md">
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Current Password
              </label>
              <input
                type="password"
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={onPasswordInputChange}
                className="w-full p-2 border rounded"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                New Password
              </label>
              <input
                type="password"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={onPasswordInputChange}
                className="w-full p-2 border rounded"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={onPasswordInputChange}
                className="w-full p-2 border rounded"
                required
              />
            </div>

            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              disabled={passwordLoading}
            >
              {passwordLoading ? 'Updating...' : 'Update Password'}
            </button>

            {passwordMessage && (
              <p
                className={`mt-2 ${
                  passwordMessage.includes('successfully')
                    ? 'text-green-500'
                    : 'text-red-500'
                }`}
              >
                {passwordMessage}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

