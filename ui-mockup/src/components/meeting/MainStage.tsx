import { Maximize2, Minimize2 } from "lucide-react";
import type { Participant } from "../../data/mockData";
import { IconButton } from "../ui/IconButton";

interface MainStageProps {
  speaker: Participant;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function MainStage({ speaker, fullscreen, onToggleFullscreen }: MainStageProps) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-slate-800">
      <img
        src={`https://picsum.photos/seed/${speaker.id}-main/800/600`}
        alt=""
        className="h-full w-full object-cover"
      />
      <div className="absolute right-3 top-3">
        <IconButton
          icon={fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          variant="dark"
          size="sm"
          onClick={onToggleFullscreen}
        />
      </div>
      <span className="absolute bottom-3 left-3 rounded-md bg-black/55 px-3 py-1 text-sm font-medium text-white">
        {speaker.name}
      </span>
    </div>
  );
}
