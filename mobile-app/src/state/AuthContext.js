import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

const demoUsers = {
  student: {
    id: "8f71928b-74d0-4dbb-b30a-1e5da85a20fd",
    name: "Aarav Student",
    role: "student"
  },
  warden: {
    id: "54c1feaf-7bb9-4cc7-ac54-f1ed08dcb22c",
    name: "Meera Warden",
    role: "warden"
  }
};

export function AuthProvider({ children }) {
  const [role, setRole] = useState("student");

  const value = {
    user: demoUsers[role],
    toggleRole: () => {
      setRole((currentRole) => (currentRole === "student" ? "warden" : "student"));
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
