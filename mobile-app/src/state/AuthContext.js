import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useState } from "react";
import {
  attendanceRequest,
  authRequest,
  getDefaultServerOrigin,
  normalizeServerOrigin,
  resolveStoredServerOrigin
} from "../api/client";
import { buildStudentSignupPayload } from "../utils/studentPortal";

const AuthContext = createContext(null);
const SESSION_KEY = "hostel-attendance.mobile.session";
const SERVER_ORIGIN_KEY = "hostel-attendance.mobile.server-origin";

async function readJson(key) {
  const value = await SecureStore.getItemAsync(key);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    await SecureStore.deleteItemAsync(key);
    return null;
  }
}

async function readString(key) {
  const value = await SecureStore.getItemAsync(key);
  return value || null;
}

async function writeJson(key, value) {
  await SecureStore.setItemAsync(key, JSON.stringify(value));
}

async function revokeAuthSession(origin, authResponse) {
  if (!authResponse?.refreshToken && !authResponse?.accessToken) {
    return;
  }

  await authRequest(origin, "/auth/logout", {
    method: "POST",
    headers: authResponse.accessToken
      ? {
          Authorization: `Bearer ${authResponse.accessToken}`,
          "Content-Type": "application/json"
        }
      : {
          "Content-Type": "application/json"
        },
    body: JSON.stringify({
      refreshToken: authResponse.refreshToken
    })
  }).catch(() => null);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [preferredServerOrigin, setPreferredServerOriginState] = useState(getDefaultServerOrigin());
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const [storedSession, storedServerOrigin] = await Promise.all([
        readJson(SESSION_KEY),
        readString(SERVER_ORIGIN_KEY)
      ]);

      if (cancelled) {
        return;
      }

      const defaultOrigin = getDefaultServerOrigin();
      const activeOrigin = resolveStoredServerOrigin({
        storedOrigin: storedServerOrigin,
        defaultOrigin
      });
      const normalizedActiveOrigin = normalizeServerOrigin(activeOrigin);

      if (storedServerOrigin !== normalizedActiveOrigin) {
        await SecureStore.setItemAsync(SERVER_ORIGIN_KEY, normalizedActiveOrigin);
      }

      if (storedSession?.user?.role === "student") {
        setSession({
          ...storedSession,
          serverOrigin: normalizedActiveOrigin
        });
      }

      setPreferredServerOriginState(normalizedActiveOrigin);
      setIsHydrated(true);
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  async function setPreferredServerOrigin(value) {
    const normalizedOrigin = normalizeServerOrigin(value);
    setPreferredServerOriginState(normalizedOrigin);
    await SecureStore.setItemAsync(SERVER_ORIGIN_KEY, normalizedOrigin);
    return normalizedOrigin;
  }

  async function persistSession(nextSession) {
    setSession(nextSession);

    if (!nextSession) {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      return;
    }

    await writeJson(SESSION_KEY, nextSession);
  }

  async function login({ email, password }) {
    const normalizedOrigin = await setPreferredServerOrigin(preferredServerOrigin);
    const response = await authRequest(normalizedOrigin, "/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    if (response.user?.role !== "student") {
      await revokeAuthSession(normalizedOrigin, response);
      throw new Error("This app is restricted to student accounts.");
    }

    const nextSession = {
      serverOrigin: normalizedOrigin,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      user: response.user
    };

    await persistSession(nextSession);
    return nextSession;
  }

  async function signup({ name, email, password, hostelId, roomNumber }) {
    const normalizedOrigin = await setPreferredServerOrigin(preferredServerOrigin);
    const payload = buildStudentSignupPayload({
      name,
      email,
      password,
      hostelId,
      roomNumber
    });
    const response = await authRequest(normalizedOrigin, "/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (response.user?.role !== "student") {
      await revokeAuthSession(normalizedOrigin, response);
      throw new Error("This app is restricted to student accounts.");
    }

    const nextSession = {
      serverOrigin: normalizedOrigin,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      user: response.user
    };

    await persistSession(nextSession);
    return nextSession;
  }

  async function getHostels() {
    const normalizedOrigin = normalizeServerOrigin(preferredServerOrigin);
    const response = await authRequest(normalizedOrigin, "/auth/hostels", {
      method: "GET"
    });
    return response.data || [];
  }

  async function refreshAccessToken(currentSession = session) {
    if (!currentSession?.refreshToken) {
      throw new Error("Session expired. Please sign in again.");
    }

    const response = await authRequest(currentSession.serverOrigin, "/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        refreshToken: currentSession.refreshToken
      })
    });

    const nextSession = {
      ...currentSession,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken || currentSession.refreshToken
    };

    await persistSession(nextSession);
    return nextSession;
  }

  async function logout() {
    const currentSession = session;

    try {
      if (currentSession?.refreshToken) {
        await authRequest(currentSession.serverOrigin, "/auth/logout", {
          method: "POST",
          headers: currentSession.accessToken
            ? {
                Authorization: `Bearer ${currentSession.accessToken}`,
                "Content-Type": "application/json"
              }
            : {
                "Content-Type": "application/json"
              },
          body: JSON.stringify({
            refreshToken: currentSession.refreshToken
          })
        });
      }
    } catch (_error) {
      // Local sign-out should still succeed even if the backend session is already gone.
    } finally {
      await persistSession(null);
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
      return await attendanceRequest(session.serverOrigin, path, {
        ...options,
        headers
      });
    } catch (error) {
      if (error.status !== 401) {
        throw error;
      }

      const refreshedSession = await refreshAccessToken(session).catch(async (refreshError) => {
        await persistSession(null);
        throw refreshError;
      });

      return attendanceRequest(refreshedSession.serverOrigin, path, {
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
        isHydrated,
        isAuthenticated: Boolean(session?.accessToken && session?.user),
        session,
        user: session?.user || null,
        preferredServerOrigin,
        setPreferredServerOrigin,
        login,
        signup,
        getHostels,
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
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
