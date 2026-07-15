import { Server as IOServer, Socket } from "socket.io";
import * as assistantService from "../modules/assistant/assistant.service";
import * as captionsService from "../modules/captions/captions.service";

interface JoinRoomPayload {
  meetingCode: string;
  userId: string;
  name: string;
}

interface LeaveRoomPayload {
  meetingCode: string;
  userId: string;
}

interface SendMessagePayload {
  meetingCode: string;
  userId: string;
  name: string;
  text: string;
}

interface ToggleMutePayload {
  meetingCode: string;
  userId: string;
  isMuted: boolean;
}

interface ToggleCameraPayload {
  meetingCode: string;
  userId: string;
  isCameraOn: boolean;
}

interface AskAIPayload {
  meetingCode: string;
  userId: string;
  name: string;
  question: string;
}

interface SetCaptionLanguagePayload {
  meetingCode: string;
  userId: string;
  language: string;
}

interface SocketData {
  meetingCode?: string;
  userId?: string;
}

export function registerMeetingEvents(io: IOServer, socket: Socket) {
  socket.on("join-room", ({ meetingCode, userId, name }: JoinRoomPayload) => {
    socket.data.meetingCode = meetingCode;
    socket.data.userId = userId;
    socket.join(meetingCode);
    socket.to(meetingCode).emit("user-joined", { userId, name });
  });

  socket.on("leave-room", ({ meetingCode, userId }: LeaveRoomPayload) => {
    socket.leave(meetingCode);
    socket.to(meetingCode).emit("user-left", { userId });
  });

  socket.on("set-caption-language", ({ meetingCode, userId, language }: SetCaptionLanguagePayload) => {
    captionsService.setLanguage(meetingCode, userId, language);
  });

  socket.on("send-message", ({ meetingCode, userId, name, text }: SendMessagePayload) => {
    io.to(meetingCode).emit("new-message", {
      userId,
      name,
      text,
      timestamp: new Date().toISOString(),
    });
    assistantService.appendToBuffer(meetingCode, { name, text });
  });

  socket.on("ask-ai", async ({ meetingCode, userId, name, question }: AskAIPayload) => {
    io.to(meetingCode).emit("new-message", {
      userId,
      name,
      text: question,
      timestamp: new Date().toISOString(),
    });
    assistantService.appendToBuffer(meetingCode, { name, text: question });

    const requestId = crypto.randomUUID();
    io.to(meetingCode).emit("ai-response-start", { requestId });
    try {
      const fullText = await assistantService.streamAnswer(meetingCode, question, (delta) => {
        io.to(meetingCode).emit("ai-response-chunk", { requestId, delta });
      });
      assistantService.appendToBuffer(meetingCode, { name: "AI Assistant", text: fullText });
      io.to(meetingCode).emit("ai-response-end", { requestId });
    } catch (err) {
      console.error(`AI assistant failed for meeting ${meetingCode}:`, err);
      io.to(meetingCode).emit("ai-response-error", { requestId });
    }
  });

  socket.on("toggle-mute", ({ meetingCode, userId, isMuted }: ToggleMutePayload) => {
    socket.to(meetingCode).emit("participant-updated", { userId, isMuted });
  });

  socket.on("toggle-camera", ({ meetingCode, userId, isCameraOn }: ToggleCameraPayload) => {
    socket.to(meetingCode).emit("participant-updated", { userId, isCameraOn });
  });

  socket.on("disconnect", () => {
    const { meetingCode, userId } = socket.data as SocketData;
    if (meetingCode && userId) {
      socket.to(meetingCode).emit("user-left", { userId });
    }
  });
}
