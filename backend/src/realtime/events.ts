import { Server as IOServer, Socket } from "socket.io";

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

  socket.on("send-message", ({ meetingCode, userId, name, text }: SendMessagePayload) => {
    io.to(meetingCode).emit("new-message", {
      userId,
      name,
      text,
      timestamp: new Date().toISOString(),
    });
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
