import type { MeetingParticipantInfo } from "../../hooks/useMeeting";

interface ParticipantListProps {
  participants: MeetingParticipantInfo[];
}

export function ParticipantList({ participants }: ParticipantListProps) {
  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto p-4">
      <h2 className="text-sm font-semibold text-gray-200">Participants ({participants.length})</h2>
      <ul className="space-y-1">
        {participants.map((p) => (
          <li key={p.userId} className="flex items-center justify-between text-sm text-gray-300">
            <span>{p.name}</span>
            {p.role === "host" && <span className="text-xs text-gray-500">Host</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
