import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useDyslexiaFont } from "../hooks/useDyslexiaFont";
import { buildGoogleCalendarUrl, buildIcsDataUrl } from "../lib/calendar";
import { getMediaPreferences, setMediaPreferences } from "../lib/mediaPreferences";
import * as api from "../services/api";
import type { CreateMeetingResponse, MyMeeting } from "../services/api";

function formatScheduledAt(iso: string): string {
  return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export function DashboardPage() {
  const { user, accessToken, logout } = useAuth();
  const navigate = useNavigate();
  const dyslexiaFont = useDyslexiaFont();
  const [title, setTitle] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [price, setPrice] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [crmWebhookUrl, setCrmWebhookUrl] = useState(user?.crmWebhookUrl ?? "");
  const [crmSaved, setCrmSaved] = useState(false);

  const [scheduleForLater, setScheduleForLater] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(
    String(getMediaPreferences().defaultDurationMinutes ?? 60),
  );
  const [scheduledMeeting, setScheduledMeeting] = useState<CreateMeetingResponse | null>(null);
  const [myMeetings, setMyMeetings] = useState<MyMeeting[]>([]);

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDeviceId, setAudioDeviceId] = useState(getMediaPreferences().audioDeviceId ?? "");
  const [videoDeviceId, setVideoDeviceId] = useState(getMediaPreferences().videoDeviceId ?? "");
  const [settingsDuration, setSettingsDuration] = useState(
    String(getMediaPreferences().defaultDurationMinutes ?? 60),
  );
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    api
      .getMyMeetings(accessToken)
      .then((res) => setMyMeetings(res.meetings))
      .catch(() => undefined);
  }, [accessToken]);

  useEffect(() => {
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((devices) => {
        setAudioDevices(devices.filter((d) => d.kind === "audioinput"));
        setVideoDevices(devices.filter((d) => d.kind === "videoinput"));
      })
      .catch(() => undefined);
  }, []);

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
      const parsedPriceCents = price.trim() ? Math.round(Number(price) * 100) : undefined;
      const parsedDuration = durationMinutes.trim() ? Number(durationMinutes) : undefined;
      const isoScheduledAt =
        scheduleForLater && scheduledAt ? new Date(scheduledAt).toISOString() : undefined;

      const meeting = await api.createMeeting(
        accessToken,
        title || undefined,
        parsedRate,
        parsedPriceCents,
        undefined,
        undefined,
        isoScheduledAt,
        parsedDuration,
      );

      if (isoScheduledAt) {
        setScheduledMeeting(meeting);
        const list = await api.getMyMeetings(accessToken).catch(() => null);
        if (list) setMyMeetings(list.meetings);
      } else {
        navigate(`/meeting/${meeting.meetingCode}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create meeting");
    }
  }

  async function handleSaveCrmWebhook(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accessToken) return;
    try {
      await api.updateCrmWebhook(accessToken, crmWebhookUrl.trim() || null);
      setCrmSaved(true);
      setTimeout(() => setCrmSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save CRM webhook");
    }
  }

  function handleSaveSettings(e: FormEvent) {
    e.preventDefault();
    setMediaPreferences({
      audioDeviceId: audioDeviceId || undefined,
      videoDeviceId: videoDeviceId || undefined,
      defaultDurationMinutes: settingsDuration.trim() ? Number(settingsDuration) : undefined,
    });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
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

  const upcomingMeetings = myMeetings.filter((m) => m.scheduledAt && m.status !== "ended");

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
              placeholder="Avg $/hr per person (optional — free unless set)"
              className="w-56 rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div className="flex gap-2">
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="Price to join $ (optional — paid meeting)"
              className="flex-1 rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={scheduleForLater}
              onChange={(e) => setScheduleForLater(e.target.checked)}
            />
            Schedule for later instead of starting now
          </label>

          {scheduleForLater && (
            <div className="flex gap-2">
              <input
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                type="datetime-local"
                required={scheduleForLater}
                className="flex-1 rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <input
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                type="number"
                min="1"
                placeholder="Duration (minutes)"
                className="w-40 rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          )}

          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            {scheduleForLater ? "Schedule meeting" : "Create"}
          </button>
        </form>

        {scheduledMeeting?.scheduledAt && (
          <div className="space-y-2 rounded border border-green-300 bg-green-50 p-4 text-sm dark:border-green-700 dark:bg-green-900/30">
            <p className="font-medium text-green-800 dark:text-green-200">
              Meeting scheduled for {formatScheduledAt(scheduledMeeting.scheduledAt)}
            </p>
            <p className="break-all text-gray-700 dark:text-gray-300">
              {window.location.origin}/meeting/{scheduledMeeting.meetingCode}
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={buildGoogleCalendarUrl(
                  scheduledMeeting.title,
                  scheduledMeeting.scheduledAt,
                  scheduledMeeting.durationMinutes ?? 60,
                  `${window.location.origin}/meeting/${scheduledMeeting.meetingCode}`,
                )}
                target="_blank"
                rel="noreferrer"
                className="rounded bg-gray-700 px-3 py-1.5 text-xs font-medium text-white"
              >
                Add to Google Calendar
              </a>
              <a
                href={buildIcsDataUrl(
                  scheduledMeeting.title,
                  scheduledMeeting.scheduledAt,
                  scheduledMeeting.durationMinutes ?? 60,
                  `${window.location.origin}/meeting/${scheduledMeeting.meetingCode}`,
                )}
                download={`${scheduledMeeting.title}.ics`}
                className="rounded bg-gray-700 px-3 py-1.5 text-xs font-medium text-white"
              >
                Download .ics
              </a>
            </div>
          </div>
        )}

        {upcomingMeetings.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Your scheduled meetings</h2>
            <ul className="space-y-2">
              {upcomingMeetings.map((m) => {
                const joinUrl = `${window.location.origin}/meeting/${m.meetingCode}`;
                return (
                  <li
                    key={m.id}
                    className="rounded border border-gray-200 p-3 text-sm dark:border-gray-700"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{m.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {m.scheduledAt ? formatScheduledAt(m.scheduledAt) : ""}
                          {m.durationMinutes ? ` · ${m.durationMinutes} min` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/meeting/${m.meetingCode}`}
                          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Join
                        </Link>
                        {m.scheduledAt && (
                          <>
                            <a
                              href={buildGoogleCalendarUrl(m.title, m.scheduledAt, m.durationMinutes ?? 60, joinUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded bg-gray-700 px-3 py-1.5 text-xs font-medium text-white"
                            >
                              Google Calendar
                            </a>
                            <a
                              href={buildIcsDataUrl(m.title, m.scheduledAt, m.durationMinutes ?? 60, joinUrl)}
                              download={`${m.title}.ics`}
                              className="rounded bg-gray-700 px-3 py-1.5 text-xs font-medium text-white"
                            >
                              .ics
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

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

        <form onSubmit={handleSaveSettings} className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Settings</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            These are used as your default camera/microphone and meeting length whenever you join or
            schedule a meeting.
          </p>
          <div className="flex gap-2">
            <select
              value={videoDeviceId}
              onChange={(e) => setVideoDeviceId(e.target.value)}
              className="flex-1 rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="">Default camera</option>
              {videoDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || "Camera"}
                </option>
              ))}
            </select>
            <select
              value={audioDeviceId}
              onChange={(e) => setAudioDeviceId(e.target.value)}
              className="flex-1 rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="">Default microphone</option>
              {audioDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || "Microphone"}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <input
              value={settingsDuration}
              onChange={(e) => setSettingsDuration(e.target.value)}
              type="number"
              min="1"
              placeholder="Default meeting duration (minutes)"
              className="flex-1 rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <button type="submit" className="rounded bg-gray-700 px-4 py-2 text-sm font-medium text-white">
              {settingsSaved ? "Saved!" : "Save"}
            </button>
          </div>
        </form>

        <form onSubmit={handleSaveCrmWebhook} className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">CRM Sync</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            When your meetings end, a JSON summary (attendees, duration, cost) is POSTed to this URL —
            point it at Zapier, Make, n8n, or any CRM's incoming-webhook endpoint.
          </p>
          <div className="flex gap-2">
            <input
              value={crmWebhookUrl}
              onChange={(e) => setCrmWebhookUrl(e.target.value)}
              type="url"
              placeholder="https://your-crm.example.com/webhook"
              className="flex-1 rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <button type="submit" className="rounded bg-gray-700 px-4 py-2 text-sm font-medium text-white">
              {crmSaved ? "Saved!" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
