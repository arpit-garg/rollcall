import { StatusBar } from "expo-status-bar";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AuthProvider, useAuth } from "./src/state/AuthContext";
import StatusCard from "./src/components/StatusCard";

function AppShell() {
  const { user, toggleRole } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Student App</Text>
          <Text style={styles.heading}>Hostel Attendance Verification</Text>
          <Text style={styles.copy}>
            This shell mirrors the TRD flow: login, enrollment, attendance submission, and history.
          </Text>
          <TouchableOpacity style={styles.roleButton} onPress={toggleRole}>
            <Text style={styles.roleButtonText}>Switch demo role</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Session</Text>
          <StatusCard
            label="Signed in as"
            value={`${user.name} (${user.role})`}
            tone="dark"
          />
          <StatusCard label="Enrollment" value="Completed" tone="success" />
          <StatusCard label="Tonight's window" value="9:00 PM to 10:00 PM" tone="accent" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Next build targets</Text>
          <StatusCard label="Camera capture" value="Expo Camera integration pending" tone="light" />
          <StatusCard label="Geofence" value="Use Expo Location + server-side Haversine check" tone="light" />
          <StatusCard label="Submission" value="Wire multipart submit + polling flow" tone="light" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0f2d3c"
  },
  container: {
    padding: 20,
    gap: 20
  },
  hero: {
    backgroundColor: "#12384b",
    borderRadius: 28,
    padding: 24,
    gap: 10
  },
  eyebrow: {
    color: "#8ed1c4",
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase"
  },
  heading: {
    color: "#f7fbfc",
    fontSize: 30,
    fontWeight: "700"
  },
  copy: {
    color: "#c8d9df",
    fontSize: 15,
    lineHeight: 22
  },
  roleButton: {
    alignSelf: "flex-start",
    backgroundColor: "#ef8354",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  roleButtonText: {
    color: "#081f29",
    fontWeight: "700"
  },
  section: {
    gap: 12
  },
  sectionTitle: {
    color: "#f7fbfc",
    fontSize: 18,
    fontWeight: "600"
  }
});
