import { useEffect, useRef } from "react";
import type { AvatarPosition } from "../../hooks/useMeeting";
import { VIRTUAL_OFFICE_HEARING_RADIUS } from "../../hooks/useMeeting";

const FLOOR_WIDTH = 900;
const FLOOR_HEIGHT = 560;
const AVATAR_RADIUS = 20;
const MOVE_SPEED = 8; // px per tick
const TICK_MS = 60;
const GRID_STEP = 40;

// A couple of lighter rectangles scattered on the floor purely for
// atmosphere — makes the space read as "an office" instead of an empty box.
const DESKS = [
  { x: 60, y: 60, w: 160, h: 90 },
  { x: FLOOR_WIDTH - 220, y: 60, w: 160, h: 90 },
  { x: 60, y: FLOOR_HEIGHT - 150, w: 160, h: 90 },
  { x: FLOOR_WIDTH - 220, y: FLOOR_HEIGHT - 150, w: 160, h: 90 },
];

const AVATAR_COLORS = ["#22c55e", "#f97316", "#a855f7", "#ec4899", "#14b8a6", "#eab308", "#f43f5e", "#0ea5e9"];

function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface RemoteAvatar {
  userId: string;
  name: string;
  position: AvatarPosition;
}

interface VirtualOfficePanelProps {
  myName: string;
  myPosition: AvatarPosition;
  remoteAvatars: RemoteAvatar[];
  onMove: (x: number, y: number) => void;
}

export function VirtualOfficePanel({ myName, myPosition, remoteAvatars, onMove }: VirtualOfficePanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heldKeysRef = useRef<Set<string>>(new Set());
  const positionRef = useRef(myPosition);
  positionRef.current = myPosition;

  function drawAvatar(ctx: CanvasRenderingContext2D, position: AvatarPosition, label: string, color: string, isMe: boolean) {
    if (isMe) {
      ctx.beginPath();
      ctx.arc(position.x, position.y, VIRTUAL_OFFICE_HEARING_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(96, 165, 250, 0.35)";
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.arc(position.x, position.y, AVATAR_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    if (isMe) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    }

    ctx.font = "600 13px system-ui, sans-serif";
    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 3;
    ctx.fillText(label, position.x, position.y + AVATAR_RADIUS + 16);
    ctx.shadowBlur = 0;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== FLOOR_WIDTH * dpr || canvas.height !== FLOOR_HEIGHT * dpr) {
      canvas.width = FLOOR_WIDTH * dpr;
      canvas.height = FLOOR_HEIGHT * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, FLOOR_WIDTH, FLOOR_HEIGHT);

    ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
    ctx.lineWidth = 1;
    for (let x = GRID_STEP; x < FLOOR_WIDTH; x += GRID_STEP) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FLOOR_HEIGHT);
      ctx.stroke();
    }
    for (let y = GRID_STEP; y < FLOOR_HEIGHT; y += GRID_STEP) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(FLOOR_WIDTH, y);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(148, 163, 184, 0.08)";
    for (const desk of DESKS) {
      ctx.beginPath();
      ctx.roundRect(desk.x, desk.y, desk.w, desk.h, 10);
      ctx.fill();
    }

    for (const avatar of remoteAvatars) {
      drawAvatar(ctx, avatar.position, avatar.name, colorForUser(avatar.userId), false);
    }
    drawAvatar(ctx, myPosition, `${myName} (You)`, "#3b82f6", true);
  }, [myPosition, remoteAvatars, myName]);

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      const el = target as HTMLElement | null;
      return !!el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      heldKeysRef.current.add(e.key.toLowerCase());
    }
    function handleKeyUp(e: KeyboardEvent) {
      heldKeysRef.current.delete(e.key.toLowerCase());
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    const interval = setInterval(() => {
      const keys = heldKeysRef.current;
      if (keys.size === 0) return;

      let { x, y } = positionRef.current;
      if (keys.has("arrowup") || keys.has("w")) y -= MOVE_SPEED;
      if (keys.has("arrowdown") || keys.has("s")) y += MOVE_SPEED;
      if (keys.has("arrowleft") || keys.has("a")) x -= MOVE_SPEED;
      if (keys.has("arrowright") || keys.has("d")) x += MOVE_SPEED;

      x = Math.max(AVATAR_RADIUS, Math.min(FLOOR_WIDTH - AVATAR_RADIUS, x));
      y = Math.max(AVATAR_RADIUS, Math.min(FLOOR_HEIGHT - AVATAR_RADIUS, y));

      if (x !== positionRef.current.x || y !== positionRef.current.y) {
        onMove(x, y);
      }
    }, TICK_MS);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMove]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-100">
      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-brand-border bg-white px-4 py-2">
        <p className="text-xs text-brand-muted">
          Move with <span className="font-semibold text-brand-text">arrow keys</span> or{" "}
          <span className="font-semibold text-brand-text">WASD</span> — walk closer to hear someone louder.
        </p>
        <span className="flex flex-shrink-0 items-center gap-1.5 text-xs text-brand-muted">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-blue-400" />
          your hearing range
        </span>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto p-4">
        <canvas
          ref={canvasRef}
          className="h-auto max-h-full w-auto max-w-full rounded-xl shadow-soft"
          style={{ aspectRatio: `${FLOOR_WIDTH} / ${FLOOR_HEIGHT}`, width: FLOOR_WIDTH, height: FLOOR_HEIGHT }}
        />
      </div>
    </div>
  );
}
