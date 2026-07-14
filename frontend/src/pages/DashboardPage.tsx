import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-white p-8 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Welcome, {user?.name}
        </h1>
        <button
          onClick={handleLogout}
          className="rounded bg-gray-200 px-3 py-2 text-sm font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-200"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
