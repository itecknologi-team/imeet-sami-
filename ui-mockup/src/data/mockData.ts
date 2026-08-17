export interface Participant {
  id: string;
  name: string;
  avatarSeed: number;
  muted: boolean;
  screenSharing: boolean;
  isYou?: boolean;
}

export interface ChatMessage {
  id: string;
  authorId: string;
  authorName: string;
  avatarSeed: number;
  timestamp: string;
  text: string;
}

export const meetingMeta = {
  title: "Chapter 3 – Continued",
  initialElapsedSeconds: 1 * 3600 + 28 * 60 + 8, // 01:28:08
  hiddenParticipantCount: 5,
};

// Alex Rivera is "you" — the main-stage speaker in the reference screenshot.
export const participants: Participant[] = [
  { id: "alex", name: "Alex Rivera (You)", avatarSeed: 11, muted: false, screenSharing: false, isYou: true },
  { id: "sarah", name: "Sarah Collins", avatarSeed: 12, muted: true, screenSharing: false },
  { id: "michael", name: "Michael Reed", avatarSeed: 13, muted: true, screenSharing: true },
  { id: "david", name: "David Klein", avatarSeed: 14, muted: true, screenSharing: false },
  { id: "emma", name: "Emma Shah", avatarSeed: 15, muted: false, screenSharing: false },
];

// The filmstrip shows everyone except the main-stage speaker (you).
export const filmstripParticipants = participants.filter((p) => !p.isYou);

export const speakerChips = [
  { id: "sarah", name: "Sarah Collins" },
  { id: "michael", name: "Michael Reed" },
  { id: "david", name: "David Klein" },
];

export const publicMessages: ChatMessage[] = [
  {
    id: "m1",
    authorId: "alex",
    authorName: "Alex Rivera (You)",
    avatarSeed: 11,
    timestamp: "12:33",
    text: "Hi everyone, hope you're all doing well. Today we're starting a new chapter — is everybody ready?",
  },
];

export const privateMessages: ChatMessage[] = [
  {
    id: "p1",
    authorId: "sarah",
    authorName: "Sarah Collins",
    avatarSeed: 12,
    timestamp: "12:31",
    text: "Quick one just for you — can you share the slides after this?",
  },
];
