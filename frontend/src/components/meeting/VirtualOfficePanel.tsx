import { useEffect, useRef } from "react";
import type { AvatarPosition } from "../../hooks/useMeeting";

const FLOOR_WIDTH = 800;
const FLOOR_HEIGHT = 500;
const AVATAR_RADIUS = 18;
const MOVE_SPEED = 8; // px per tick
const TICK_MS = 100;

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

  function drawAvatar(ctx: CanvasRenderingContext2D, position: AvatarPosition, label: string, color: string) {
    ctx.beginPath();
    ctx.arc(position.x, position.y, AVATAR_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#e5e7eb";
    ctx.textAlign = "center";
    ctx.fillText(label, position.x, position.y + AVATAR_RADIUS + 14);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, FLOOR_WIDTH, FLOOR_HEIGHT);
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, FLOOR_WIDTH, FLOOR_HEIGHT);
    for (const avatar of remoteAvatars) {
      drawAvatar(ctx, avatar.position, avatar.name, "#22c55e");
    }
    drawAvatar(ctx, myPosition, `${myName} (You)`, "#3b82f6");
  }, [myPosition, remoteAvatars, myName]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
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
    <div className="flex h-full flex-col overflow-hidden bg-gray-950">
      <div className="border-b border-gray-800 px-3 py-2 text-xs text-gray-400">
        Move with arrow keys or WASD — walk closer to hear someone louder.
      </div>
      <div className="flex-1 overflow-auto p-4">
        <canvas ref={canvasRef} width={FLOOR_WIDTH} height={FLOOR_HEIGHT} className="rounded" />
      </div>
    </div>
  );
}
