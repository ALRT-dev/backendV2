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
    console.log("New client connected:", socket.id);

    socket.join("user_" + socket.userId);

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });
};

export default ioClient;
