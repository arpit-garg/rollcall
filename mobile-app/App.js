import React from "react";
import { ActivityIndicator, SafeAreaView, View, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "./src/state/AuthContext";
import LoginScreen from "./src/screens/LoginScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import styles from "./src/styles";

function AppShell() {
  const {
    isHydrated,
    isAuthenticated,
    preferredServerOrigin,
    login,
    logout,
    user,
    session,
    authorizedRequest
  } = useAuth();

  if (!isHydrated) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.loaderState}>
          <ActivityIndicator size="large" color="#06B6D4" />
          <Text style={styles.loaderText}>BOOTING SECURE GATEWAY...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginScreen />
    );
  }

  return (
    <DashboardScreen
      user={user}
      session={session}
      authorizedRequest={authorizedRequest}
      logout={logout}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
