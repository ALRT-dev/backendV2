import type { DefaultEventsMap, Server, Socket } from "socket.io";

let ioClient: Server<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  any
> | null = null;

/// Initializes the Socket.IO client and sets up connection handling.
export const initSocket = (
  io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>
) => {
  ioClient = io;
  ioClient.on("connection", (socket: Socket) => {
    console.log("New client connected:", socket.id, "userId:", socket.userId);

    if (socket.userId) {
      const roomName = "user_" + socket.userId;
      socket.join(roomName);
      console.log(`User ${socket.userId} joined room: ${roomName}`);
    } else {
      console.error("Socket connected but userId is undefined!");
    }

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id, "userId:", socket.userId);
    });
  });
};

/// Gets the current Socket.IO client instance
export const getSocketClient = () => {
  if (!ioClient) {
    console.error("Socket.IO client not initialized!");
  }
  return ioClient;
};
