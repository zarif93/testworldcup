/**
 * מתחבר ל-Socket.IO ומאזין לעדכוני נקודות בזמן אמת.
 * מעדכן את יתרת המשתמש ב-AuthContext ומרענן שאילתות רלוונטיות (ארנק סוכן, רשימת משתמשים במנהל).
 */
import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

const SOCKET_PATH = "/api/socket.io";

export function PointsSocketSync() {
  const { user, updatePointsFromSocket } = useAuth();
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user?.id) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const url = typeof window !== "undefined" ? window.location.origin : "";
    const socket = io(url, {
      path: SOCKET_PATH,
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("points-update", (payload: { userId: number; balance: number; actionType?: string }) => {
      const { userId, balance } = payload;
      updatePointsFromSocket(userId, balance);
      // רענון נתונים בדפים שמוצגים: ארנק סוכן, רשימת משתמשים במנהל, מאזנים
      queryClient.invalidateQueries({ queryKey: [["agent", "getWallet"]] });
      queryClient.invalidateQueries({ queryKey: [["agent", "getTransferLog"]] });
      queryClient.invalidateQueries({ queryKey: [["agent", "getMyReport"]] });
      queryClient.invalidateQueries({ queryKey: [["agent", "getCommissionReport"]] });
      queryClient.invalidateQueries({ queryKey: [["agent", "getMyPointsHistory"]] });
      queryClient.invalidateQueries({ queryKey: [["admin", "getUsers"]] });
      queryClient.invalidateQueries({ queryKey: [["admin", "getBalanceSummary"]] });
      queryClient.invalidateQueries({ queryKey: [["admin", "getAgentsWithBalances"]] });
      queryClient.invalidateQueries({ queryKey: [["auth", "me"]] });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, updatePointsFromSocket, queryClient]);

  return null;
}
