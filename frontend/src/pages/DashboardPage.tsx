import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useDyslexiaFont } from "../hooks/useDyslexiaFont";
import * as api from "../services/api";

export function DashboardPage() {
  const { user, accessToken, logout } = useAuth();
  const navigate = useNavigate();
  const dyslexiaFont = useDyslexiaFont();
  const [title, setTitle] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  async function handleCreateMeeting(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accessToken) return;
    try {
      const parsedRate = hourlyRate.trim() ? Number(hourlyRate) : undefined;
      const meeting = await api.createMeeting(accessToken, title || undefined, parsedRate);
      navigate(`/meeting/${meeting.meetingCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create meeting");
    }
  }

  async function handleJoinMeeting(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!joinCode.trim()) return;
    try {
      await api.getMeeting(joinCode.trim());
      navigate(`/meeting/${joinCode.trim()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Meeting not found");
    }
  }

  return (
    <div className="min-h-screen bg-white p-8 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Welcome, {user?.name}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={dyslexiaFont.toggle}
            className="rounded bg-gray-200 px-3 py-2 text-sm font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-200"
          >
            Dyslexia Font: {dyslexiaFont.enabled ? "On" : "Off"}
          </button>
          <button
            onClick={handleLogout}
            className="rounded bg-gray-200 px-3 py-2 text-sm font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-200"
          >
            Log out
          </button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-8 grid max-w-xl gap-8">
        <form onSubmit={handleCreateMeeting} className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Start a new meeting</h2>
          <div className="flex gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Meeting title (optional)"
              className="flex-1 rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <input
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="Avg $/hr per person (default $50)"
              className="w-56 rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white">
              Create
            </button>
          </div>
        </form>

        <form onSubmit={handleJoinMeeting} className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Join a meeting</h2>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Meeting code"
              className="flex-1 rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <button type="submit" className="rounded bg-gray-700 px-4 py-2 text-sm font-medium text-white">
              Join
            </button>
          </div>
        </form>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Async Video Messages</h2>
          <Link
            to="/videos/mine"
            className="inline-block rounded bg-gray-700 px-4 py-2 text-sm font-medium text-white"
          >
            My Videos
          </Link>
        </div>
      </div>
    </div>
  );
}
