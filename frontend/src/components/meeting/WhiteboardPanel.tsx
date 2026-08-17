import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, MutableRefObject } from "react";
import type { Socket } from "socket.io-client";
import type { WhiteboardPoint, WhiteboardStroke } from "../../hooks/useMeeting";
import { generateId } from "../../lib/uuid";

const COLORS = ["#f8fafc", "#ef4444", "#3b82f6", "#22c55e", "#eab308"];
const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 900;

interface WhiteboardPanelProps {
  socket: Socket | null;
  meetingCode: string;
  historyRef: MutableRefObject<WhiteboardStroke[]>;
}

export function WhiteboardPanel({ socket, meetingCode, historyRef }: WhiteboardPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(COLORS[0]);
  const drawingRef = useRef<{ strokeId: string; lastPoint: WhiteboardPoint } | null>(null);

  function drawSegment(from: WhiteboardPoint, to: WhiteboardPoint, strokeColor: string) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  function redrawAll() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of historyRef.current) {
      for (let i = 1; i < stroke.points.length; i++) {
        drawSegment(stroke.points[i - 1], stroke.points[i], stroke.color);
      }
    }
  }

  useEffect(() => {
    redrawAll();
    // Only replaying the backlog present at mount time — live updates below keep it current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!socket) return;

    const lastPoints = new Map<string, WhiteboardPoint>();
    const strokeColors = new Map<string, string>();

    function handleStart({ strokeId, color: c, point }: { strokeId: string; color: string; point: WhiteboardPoint }) {
      strokeColors.set(strokeId, c);
      lastPoints.set(strokeId, point);
    }
    function handlePoint({ strokeId, point }: { strokeId: string; point: WhiteboardPoint }) {
      const prev = lastPoints.get(strokeId);
      if (prev) {
        drawSegment(prev, point, strokeColors.get(strokeId) ?? COLORS[0]);
      }
      lastPoints.set(strokeId, point);
    }
    function handleClearOrHistory() {
      lastPoints.clear();
      strokeColors.clear();
      redrawAll();
    }

    socket.on("whiteboard-stroke-start", handleStart);
    socket.on("whiteboard-point", handlePoint);
    socket.on("whiteboard-clear", handleClearOrHistory);
    socket.on("whiteboard-history", handleClearOrHistory);

    return () => {
      socket.off("whiteboard-stroke-start", handleStart);
      socket.off("whiteboard-point", handlePoint);
      socket.off("whiteboard-clear", handleClearOrHistory);
      socket.off("whiteboard-history", handleClearOrHistory);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  function getPoint(e: ReactPointerEvent<HTMLCanvasElement>): WhiteboardPoint {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!socket) return;
    const point = getPoint(e);
    const strokeId = generateId();
    drawingRef.current = { strokeId, lastPoint: point };
    historyRef.current.push({ id: strokeId, color, points: [point] });
    socket.emit("whiteboard-stroke-start", { meetingCode, strokeId, color, point });
    canvasRef.current?.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    const drawing = drawingRef.current;
    if (!drawing || !socket) return;
    const point = getPoint(e);
    drawSegment(drawing.lastPoint, point, color);
    const stroke = historyRef.current.find((s) => s.id === drawing.strokeId);
    stroke?.points.push(point);
    socket.emit("whiteboard-point", { meetingCode, strokeId: drawing.strokeId, point });
    drawingRef.current = { ...drawing, lastPoint: point };
  }

  function handlePointerUp() {
    drawingRef.current = null;
  }

  function handleClear() {
    socket?.emit("whiteboard-clear", { meetingCode });
    historyRef.current = [];
    redrawAll();
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-950">
      <div className="flex items-center gap-2 border-b border-gray-800 px-3 py-2">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-blue-400" : "border-transparent"}`}
            style={{ backgroundColor: c }}
            aria-label={`Color ${c}`}
          />
        ))}
        <button
          onClick={handleClear}
          className="ml-2 rounded bg-gray-700 px-3 py-1 text-xs font-medium text-white"
        >
          Clear
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="cursor-crosshair bg-gray-900"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      </div>
    </div>
  );
}
