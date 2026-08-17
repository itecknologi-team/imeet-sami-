import { Building2, Code, Presentation, Video } from "lucide-react";

export type ActiveView = "video" | "whiteboard" | "code" | "virtual-office";

export const VIEW_LABELS: Record<ActiveView, string> = {
  video: "Video",
  whiteboard: "Whiteboard",
  code: "Code",
  "virtual-office": "Virtual Office",
};

export const VIEW_ICONS: Record<ActiveView, typeof Video> = {
  video: Video,
  whiteboard: Presentation,
  code: Code,
  "virtual-office": Building2,
};

export const ACTIVE_VIEWS: ActiveView[] = ["video", "whiteboard", "code", "virtual-office"];
