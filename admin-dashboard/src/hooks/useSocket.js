import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_ATTENDANCE_WS_URL || "http://localhost:3002";

export function useSocket() {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const instance = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      withCredentials: true
    });

    instance.on("connect", () => setIsConnected(true));
    instance.on("disconnect", () => setIsConnected(false));

    setSocket(instance);

    return () => {
      instance.disconnect();
    };
  }, []);

  return { socket, isConnected };
}
