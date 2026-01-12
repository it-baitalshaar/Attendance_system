export default function NotAuthorized() {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-red-600">Access Denied</h1>
          <p className="mt-4 text-gray-700">
            You do not have permission to view this page.
          </p>
          <a
            href="/app/login"
            className="mt-6 inline-block rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }
  