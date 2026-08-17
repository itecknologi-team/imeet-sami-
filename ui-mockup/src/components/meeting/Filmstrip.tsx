import { meetingMeta, type Participant } from "../../data/mockData";

interface FilmstripProps {
  participants: Participant[];
}

export function Filmstrip({ participants }: FilmstripProps) {
  return (
    <div className="flex gap-3 overflow-x-auto border-b border-border bg-white px-4 py-3">
      <div className="relative flex h-20 w-32 flex-shrink-0 items-center justify-center rounded-xl bg-slate-800">
        <div className="flex -space-x-3">
          {participants.slice(0, 3).map((p) => (
            <img
              key={p.id}
              src={`https://i.pravatar.cc/150?img=${p.avatarSeed}`}
              alt=""
              className="h-9 w-9 rounded-full border-2 border-slate-800 object-cover"
            />
          ))}
        </div>
        <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-orange px-1 text-[10px] font-bold text-white">
          +{meetingMeta.hiddenParticipantCount}
        </span>
      </div>

      {participants.map((p) => (
        <div key={p.id} className="relative h-20 w-32 flex-shrink-0 overflow-hidden rounded-xl bg-slate-700">
          <img
            src={`https://picsum.photos/seed/${p.id}/240/160`}
            alt=""
            className="h-full w-full object-cover"
          />
          <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">
            {p.name}
          </span>
        </div>
      ))}
    </div>
  );
}
