import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Wordmark } from "../components/brand/Wordmark";
import { useAuth } from "../hooks/useAuth";
import { copyRichToClipboard, copyToClipboard } from "../lib/clipboard";
import { buildInviteMessage } from "../lib/meetingInviteMessage";

interface ReadyNavState {
  title?: string;
  guestName?: string;
  passcode?: string;
  guestId?: string;
}

export function MeetingReadyPage() {
  const { meetingCode = "" } = useParams<{ meetingCode: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as ReadyNavState | null) ?? null;

  const [copied, setCopied] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const inviteLink = `${window.location.origin}/meeting/${meetingCode}`;
  const recoveryLink = state?.guestId ? `${inviteLink}?hostKey=${state.guestId}` : null;

  useEffect(() => {
    QRCode.toDataURL(inviteLink, { margin: 1, width: 240 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [inviteLink]);

  async function handleCopyLink() {
    const { text, html } = buildInviteMessage({
      title: state?.title,
      hostName: user?.name ?? state?.guestName ?? "Someone",
      link: inviteLink,
    });
    await copyRichToClipboard(text, html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCopyRecoveryLink() {
    if (!recoveryLink) return;
    await copyToClipboard(recoveryLink);
    setRecoveryCopied(true);
    setTimeout(() => setRecoveryCopied(false), 2000);
  }

  function handleJoinNow() {
    navigate(`/meeting/${meetingCode}`, {
      state: user ? undefined : { guestName: state?.guestName, passcode: state?.passcode },
    });
  }

  return (
    <div className="page-bg flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
      <Wordmark size="lg" />

      <div className="w-full max-w-md rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-soft">
        <h1 className="text-lg font-semibold text-brand-text">Meeting ready</h1>

        <div className="mt-4">
          <label className="mb-1.5 block text-sm text-brand-muted">Share this link</label>
          <input
            readOnly
            value={inviteLink}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-[10px] border border-brand-border px-4 py-3 text-sm text-brand-text"
          />
        </div>

        <button
          type="button"
          onClick={handleCopyLink}
          className="mt-3 rounded-full border border-brand-border px-4 py-2 text-sm font-medium text-brand-text hover:bg-slate-50"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>

        {qrDataUrl && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <img src={qrDataUrl} alt="QR code to join the meeting" width={200} height={200} />
            <p className="text-sm text-brand-muted">Scan to join on a phone</p>
          </div>
        )}

        {recoveryLink && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowRecovery((v) => !v)}
              className="text-sm text-brand-text hover:underline"
            >
              {showRecovery ? "▼" : "▶"} Lost your host access later? Save this link
            </button>
            {showRecovery && (
              <div className="mt-2 space-y-2">
                <input
                  readOnly
                  value={recoveryLink}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-[10px] border border-brand-border px-4 py-2.5 text-xs text-brand-muted"
                />
                <button
                  type="button"
                  onClick={handleCopyRecoveryLink}
                  className="rounded-full border border-brand-border px-4 py-1.5 text-xs font-medium text-brand-text hover:bg-slate-50"
                >
                  {recoveryCopied ? "Copied!" : "Copy recovery link"}
                </button>
                <p className="text-xs text-brand-muted">
                  Opening this link (even on a different device or browser) restores your host controls for this
                  meeting — keep it somewhere safe.
                </p>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleJoinNow}
          className="mt-6 w-full rounded-full bg-brand-blue py-3 text-center text-sm font-bold text-white transition-colors hover:bg-brand-blue-dark"
        >
          Join now
        </button>
      </div>

      <p className="text-xs text-brand-muted">
        A product of <span className="font-semibold text-brand-text">iTecknologi Group</span>
      </p>
    </div>
  );
}
