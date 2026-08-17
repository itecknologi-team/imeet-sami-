import { BarChart2, Film, Home, Video } from "lucide-react";
import { useState } from "react";
import { IconButton } from "../ui/IconButton";

type Nav = "home" | "recordings" | "analytics";

export function IconRail() {
  const [active, setActive] = useState<Nav>("home");

  return (
    <div className="flex w-[72px] flex-shrink-0 flex-col items-center gap-6 rounded-2xl border border-border bg-surface py-4 shadow-soft">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--brand-cyan),var(--brand-green))] text-white">
        <Video className="h-4 w-4" />
      </div>

      <nav className="flex flex-col gap-2">
        <IconButton
          icon={<Home className="h-4 w-4" />}
          label="Home"
          active={active === "home"}
          onClick={() => setActive("home")}
        />
        <IconButton
          icon={<Film className="h-4 w-4" />}
          label="Recordings"
          active={active === "recordings"}
          onClick={() => setActive("recordings")}
        />
        <IconButton
          icon={<BarChart2 className="h-4 w-4" />}
          label="Analytics"
          active={active === "analytics"}
          onClick={() => setActive("analytics")}
        />
      </nav>

      <img
        src="https://i.pravatar.cc/150?img=11"
        alt="Your avatar"
        className="mt-auto h-9 w-9 rounded-full object-cover"
      />
    </div>
  );
}
