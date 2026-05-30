import { createContext, useContext, useEffect, useState } from "react";
import { attendanceRequest, authRequest } from "../api/client.js";

const STORAGE_KEY = "hostel-attendance.warden-user";

const AuthContext = createContext(null);

function loadStoredSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawSession = window.sessionStorage.getItem(STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSession);
    const user = parsed?.user?.role === "warden" ? parsed.user : parsed?.role === "warden" ? parsed : null;
    return user ? { accessToken: null, user } : null;
  } catch (_error) {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function persistUser(session) {
  if (typeof window === "undefined") {
    return;
  }

  if (!session) {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ user: session.user }));
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadStoredSession());
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (!session?.user || session.accessToken) {
      setIsHydrated(true);
      return;
    }

    refreshAccessToken(session)
      .catch(() => {
        setSession(null);
        persistUser(null);
      })
      .finally(() => setIsHydrated(true));
    // Restore once from the refresh cookie after loading the persisted warden user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login({ email, password }) {
    const response = await authRequest("/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    if (response.user?.role !== "warden") {
      await authRequest("/auth/logout", {
        method: "POST",
        headers: response.accessToken
          ? {
              Authorization: `Bearer ${response.accessToken}`
            }
          : undefined
      }).catch(() => null);

      throw new Error("This dashboard is restricted to warden accounts.");
    }

    const nextSession = {
      accessToken: response.accessToken,
      user: response.user
    };

    setSession(nextSession);
    persistUser(nextSession);

    return nextSession;
  }

  async function refreshAccessToken(currentSession = session) {
    if (!currentSession?.user) {
      throw new Error("Session expired. Please sign in again.");
    }

    const response = await authRequest("/auth/refresh", {
      method: "POST"
    });

    const nextSession = {
      ...currentSession,
      accessToken: response.accessToken
    };

    setSession(nextSession);
    persistUser(nextSession);

    return nextSession;
  }

  async function logout() {
    try {
      await authRequest("/auth/logout", {
        method: "POST",
        headers: session?.accessToken
          ? {
              Authorization: `Bearer ${session.accessToken}`
            }
          : undefined
      });
    } catch (_error) {
      // Local logout should still succeed even if the cookie is already gone.
    } finally {
      setSession(null);
      persistUser(null);
    }
  }

  async function authorizedRequest(path, options = {}) {
    if (!session?.accessToken) {
      throw new Error("Session expired. Please sign in again.");
    }

    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${session.accessToken}`
    };

    try {
      return await attendanceRequest(path, {
        ...options,
        headers
      });
    } catch (error) {
      if (error.status !== 401) {
        throw error;
      }

      const refreshedSession = await refreshAccessToken(session).catch(async (refreshError) => {
        await logout();
        throw refreshError;
      });

      return attendanceRequest(path, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${refreshedSession.accessToken}`
        }
      });
    }
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: Boolean(session?.accessToken && session?.user),
        isHydrated,
        session,
        user: session?.user || null,
        login,
        logout,
        authorizedRequest
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
