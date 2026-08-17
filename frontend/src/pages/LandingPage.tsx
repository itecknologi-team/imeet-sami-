import { Hash, Lock, Settings as SettingsIcon, User } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CompanyLogo } from "../components/brand/CompanyLogo";
import { HeroIllustration } from "../components/brand/HeroIllustration";
import { Wordmark } from "../components/brand/Wordmark";
import { DevicePreviewModal } from "../components/DevicePreviewModal";
import { useAuth } from "../hooks/useAuth";
import { buildGoogleCalendarUrl, buildIcsDataUrl } from "../lib/calendar";
import { getGuestId } from "../lib/guestId";
import { getMediaPreferences } from "../lib/mediaPreferences";
import * as api from "../services/api";
import type { CreateMeetingResponse } from "../services/api";

type Tab = "new" | "join";

export function LandingPage() {
  const { user, accessToken, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("new");
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [scheduleForLater, setScheduleForLater] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(
    String(getMediaPreferences().defaultDurationMinutes ?? 60),
  );
  const [scheduledMeeting, setScheduledMeeting] = useState<CreateMeetingResponse | null>(null);

  const [showDeviceModal, setShowDeviceModal] = useState(false);

  async function handleStartMeeting(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!user && !name.trim()) {
      setError("Enter your name to start a meeting");
      return;
    }
    if (scheduleForLater && !scheduledAt) {
      setError("Pick a date and time to schedule the meeting");
      return;
    }
    setSubmitting(true);
    try {
      const guestId = getGuestId();
      const guest = user ? undefined : { guestId, guestName: name.trim() };
      const isoScheduledAt = scheduleForLater && scheduledAt ? new Date(scheduledAt).toISOString() : undefined;
      const parsedDuration = durationMinutes.trim() ? Number(durationMinutes) : undefined;
      const meeting = await api.createMeeting(
        accessToken,
        title.trim() || undefined,
        undefined,
        undefined,
        guest,
        passcode.trim() || undefined,
        isoScheduledAt,
        parsedDuration,
      );
      if (isoScheduledAt) {
        setScheduledMeeting(meeting);
      } else {
        navigate(`/meeting/${meeting.meetingCode}/ready`, {
          state: {
            title: meeting.title,
            ...(user ? {} : { guestName: name.trim(), passcode: passcode.trim() || undefined, guestId }),
          },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start meeting");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleJoinMeeting(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!joinCode.trim()) {
      setError("Enter a meeting code");
      return;
    }
    if (!user && !name.trim()) {
      setError("Enter your name to join");
      return;
    }
    setSubmitting(true);
    try {
      await api.getMeeting(joinCode.trim());
      navigate(`/meeting/${joinCode.trim()}`, {
        state: user ? undefined : { guestName: name.trim(), passcode: passcode.trim() || undefined },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Meeting not found");
    } finally {
      setSubmitting(false);
    }
  }

  const joinUrl = scheduledMeeting ? `${window.location.origin}/meeting/${scheduledMeeting.meetingCode}` : "";

  return (
    <div className="page-bg flex h-screen flex-col overflow-hidden">
      <div className="flex flex-shrink-0 items-start justify-between px-6 pt-3 sm:px-12">
        <CompanyLogo />
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setShowDeviceModal(true)}
            aria-label="Settings"
            title="Camera & microphone settings"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-border bg-white text-brand-text hover:bg-slate-50"
          >
            <SettingsIcon className="h-4 w-4" />
          </button>
          {user ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-brand-muted sm:inline">Signed in as {user.name}</span>
              <Link to="/dashboard" className="rounded-full bg-brand-blue px-3.5 py-1.5 font-medium text-white">
                Dashboard
              </Link>
              <button
                onClick={() => logout()}
                className="rounded-full border border-brand-border px-3.5 py-1.5 font-medium text-brand-text hover:bg-slate-50"
              >
                Log out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="rounded-full border border-brand-border bg-white px-3.5 py-1.5 font-medium text-brand-text hover:bg-slate-50"
              >
                Sign in
              </Link>
              <Link to="/signup" className="rounded-full bg-brand-blue px-3.5 py-1.5 font-medium text-white">
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-3 sm:px-12 md:flex-row md:gap-20">
        <div className="hidden w-full max-w-lg md:block">
          <HeroIllustration onOpenPreview={() => setShowDeviceModal(true)} />
        </div>

        <div className="w-full max-w-md">
          <Wordmark size="lg" />
          <p className="mt-2 max-w-sm text-base text-brand-muted">
            Secure video meetings right in your browser — no downloads, no accounts required.
          </p>

          {error && <p className="mt-2 text-sm text-brand-danger">{error}</p>}

          {scheduledMeeting?.scheduledAt ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-soft">
              <div className="h-1.5 w-full bg-[linear-gradient(90deg,var(--color-brand-cyan),var(--color-brand-blue),var(--color-brand-teal))]" />
              <div className="p-6">
                <p className="text-sm font-semibold text-brand-text">
                  Meeting scheduled for{" "}
                  {new Date(scheduledMeeting.scheduledAt).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
                <p className="mt-2 break-all text-sm text-brand-muted">{joinUrl}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <a
                    href={buildGoogleCalendarUrl(
                      scheduledMeeting.title,
                      scheduledMeeting.scheduledAt,
                      scheduledMeeting.durationMinutes ?? 60,
                      joinUrl,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-brand-blue px-4 py-2 text-xs font-semibold text-white hover:bg-brand-blue-dark"
                  >
                    Add to Google Calendar
                  </a>
                  <a
                    href={buildIcsDataUrl(
                      scheduledMeeting.title,
                      scheduledMeeting.scheduledAt,
                      scheduledMeeting.durationMinutes ?? 60,
                      joinUrl,
                    )}
                    download={`${scheduledMeeting.title}.ics`}
                    className="rounded-full border border-brand-border px-4 py-2 text-xs font-semibold text-brand-text hover:bg-slate-50"
                  >
                    Download .ics
                  </a>
                  <button
                    type="button"
                    onClick={() => setScheduledMeeting(null)}
                    className="rounded-full border border-brand-border px-4 py-2 text-xs font-semibold text-brand-text hover:bg-slate-50"
                  >
                    Schedule another
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-4 inline-flex rounded-full bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setTab("new")}
                  className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                    tab === "new" ? "bg-white text-brand-text shadow-soft" : "text-brand-muted hover:text-brand-text"
                  }`}
                >
                  New meeting
                </button>
                <button
                  type="button"
                  onClick={() => setTab("join")}
                  className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                    tab === "join" ? "bg-white text-brand-text shadow-soft" : "text-brand-muted hover:text-brand-text"
                  }`}
                >
                  Join meeting
                </button>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-soft">
                <div className="h-1.5 w-full bg-[linear-gradient(90deg,var(--color-brand-cyan),var(--color-brand-blue),var(--color-brand-teal))]" />
                <div className="p-5">
                  {tab === "new" ? (
                    <form onSubmit={handleStartMeeting}>
                      <div className="mb-3">
                        <label className="mb-1.5 block text-sm font-medium text-brand-text">Meeting title</label>
                        <input
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Meeting title (optional)"
                          className="w-full rounded-[10px] border border-brand-border px-4 py-2.5 text-sm placeholder:text-brand-muted"
                        />
                      </div>
                      {!user && (
                        <div className="mb-3">
                          <label className="mb-1.5 block text-sm font-medium text-brand-text">Your name</label>
                          <div className="relative">
                            <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                            <input
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              placeholder="Your name"
                              className="w-full rounded-[10px] border border-brand-border py-2.5 pl-10 pr-4 text-sm placeholder:text-brand-muted"
                            />
                          </div>
                        </div>
                      )}
                      <div className="mb-3">
                        <label className="mb-1.5 block text-sm font-medium text-brand-text">Passcode (optional)</label>
                        <div className="relative">
                          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                          <input
                            value={passcode}
                            onChange={(e) => setPasscode(e.target.value)}
                            placeholder="At least 4 characters"
                            className="w-full rounded-[10px] border border-brand-border py-2.5 pl-10 pr-4 text-sm placeholder:text-brand-muted"
                          />
                        </div>
                      </div>

                      <label className="mb-3 flex items-center gap-2 text-sm font-medium text-brand-text">
                        <input
                          type="checkbox"
                          checked={scheduleForLater}
                          onChange={(e) => setScheduleForLater(e.target.checked)}
                        />
                        Schedule for later instead of starting now
                      </label>

                      {scheduleForLater && (
                        <div className="mb-4 flex gap-2">
                          <input
                            value={scheduledAt}
                            onChange={(e) => setScheduledAt(e.target.value)}
                            type="datetime-local"
                            required
                            className="flex-1 rounded-[10px] border border-brand-border px-4 py-2.5 text-sm"
                          />
                          <input
                            value={durationMinutes}
                            onChange={(e) => setDurationMinutes(e.target.value)}
                            type="number"
                            min="1"
                            placeholder="Minutes"
                            className="w-28 rounded-[10px] border border-brand-border px-4 py-2.5 text-sm placeholder:text-brand-muted"
                          />
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full rounded-[10px] bg-brand-blue py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-brand-blue-dark disabled:opacity-50"
                      >
                        {submitting
                          ? scheduleForLater
                            ? "Scheduling..."
                            : "Starting..."
                          : scheduleForLater
                            ? "Schedule meeting"
                            : "Start meeting"}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleJoinMeeting}>
                      <div className="mb-3">
                        <label className="mb-1.5 block text-sm font-medium text-brand-text">Meeting code</label>
                        <div className="relative">
                          <Hash className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                          <input
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value)}
                            placeholder="abc-defg-hij"
                            className="w-full rounded-[10px] border border-brand-border py-2.5 pl-10 pr-4 font-mono text-sm placeholder:text-brand-muted"
                          />
                        </div>
                      </div>
                      {!user && (
                        <div className="mb-3">
                          <label className="mb-1.5 block text-sm font-medium text-brand-text">Your name</label>
                          <div className="relative">
                            <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                            <input
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              placeholder="Your name"
                              className="w-full rounded-[10px] border border-brand-border py-2.5 pl-10 pr-4 text-sm placeholder:text-brand-muted"
                            />
                          </div>
                        </div>
                      )}
                      <div className="mb-4">
                        <label className="mb-1.5 block text-sm font-medium text-brand-text">Passcode (if required)</label>
                        <div className="relative">
                          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                          <input
                            value={passcode}
                            onChange={(e) => setPasscode(e.target.value)}
                            placeholder="Leave blank if none"
                            className="w-full rounded-[10px] border border-brand-border py-2.5 pl-10 pr-4 text-sm placeholder:text-brand-muted"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full rounded-[10px] bg-brand-blue py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-brand-blue-dark disabled:opacity-50"
                      >
                        {submitting ? "Joining..." : "Join meeting"}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </>
          )}

          <p className="mt-3 text-center text-sm text-brand-muted">
            Free to create and join — no charges. Sign in to unlock recordings, transcripts, CRM sync and more.
          </p>
        </div>
      </main>

      <footer className="flex-shrink-0 pb-3 text-center text-xs text-brand-muted">
        A product of <span className="font-semibold text-brand-text">iTecknologi-AI Lab</span>
      </footer>

      {showDeviceModal && <DevicePreviewModal onClose={() => setShowDeviceModal(false)} />}
    </div>
  );
}
