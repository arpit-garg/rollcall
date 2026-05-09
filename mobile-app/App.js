import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import StatusCard from "./src/components/StatusCard";
import { AuthProvider, useAuth } from "./src/state/AuthContext";

function createIdempotencyKey() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const randomValue = Math.floor(Math.random() * 16);
    const value = character === "x" ? randomValue : (randomValue & 0x3) | 0x8;
    return value.toString(16);
  });
}

function formatDateTime(value) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function normalizeErrorMessage(error) {
  return error?.body?.error?.message || error?.message || "Something went wrong.";
}

function getEnrollmentTone(status) {
  if (status === "enrolled") {
    return "success";
  }

  if (status === "processing") {
    return "accent";
  }

  return "light";
}

function getAttendanceTone(status) {
  if (status === "verified") {
    return "success";
  }

  if (status === "pending") {
    return "accent";
  }

  if (status === "failed") {
    return "danger";
  }

  return "light";
}

function ActionButton({ label, onPress, disabled = false, tone = "primary" }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionButton,
        tone === "secondary" ? styles.secondaryButton : styles.primaryButton,
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null
      ]}
    >
      <Text
        style={[
          styles.actionButtonText,
          tone === "secondary" ? styles.secondaryButtonText : styles.primaryButtonText
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SectionCard({ title, subtitle, children, rightAction }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
        {rightAction}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function LoginScreen({ preferredServerOrigin, onLogin, isSubmitting }) {
  const [serverOrigin, setServerOrigin] = useState(preferredServerOrigin);
  const [email, setEmail] = useState("student@college.edu");
  const [password, setPassword] = useState("Student@123");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setServerOrigin(preferredServerOrigin);
  }, [preferredServerOrigin]);

  async function handleLogin() {
    setErrorMessage("");

    try {
      await onLogin({
        serverOrigin,
        email,
        password
      });
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error));
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.loginContainer}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Student App</Text>
          <Text style={styles.heading}>Hostel Attendance Verification</Text>
          <Text style={styles.copy}>
            Sign in as a student, enroll your face template, mark attendance with camera and
            location, and review your history from one mobile screen.
          </Text>
        </View>

        <SectionCard
          title="Student Login"
          subtitle="Use the seeded demo student credentials or your own student account."
        >
          <Text style={styles.fieldLabel}>Server Origin</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            value={serverOrigin}
            onChangeText={setServerOrigin}
            placeholder="http://10.0.2.2"
            placeholderTextColor="#7a8b95"
          />

          <Text style={styles.inputHint}>
            Android emulator usually uses `http://10.0.2.2`. Physical devices should use your
            computer's LAN IP.
          </Text>

          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="student@college.edu"
            placeholderTextColor="#7a8b95"
          />

          <Text style={styles.fieldLabel}>Password</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="Student@123"
            placeholderTextColor="#7a8b95"
          />

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <View style={styles.inlineButtons}>
            <ActionButton
              label={isSubmitting ? "Signing in..." : "Sign In"}
              onPress={handleLogin}
              disabled={isSubmitting}
            />
          </View>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function CaptureModal({ visible, mode, cameraRef, onClose, onCapture, isBusy }) {
  const title =
    mode === "enrollment"
      ? "Capture enrollment photo"
      : "Capture attendance photo";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.modalRoot}>
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalEyebrow}>Camera</Text>
            <Text style={styles.modalTitle}>{title}</Text>
          </View>
          <ActionButton label="Close" onPress={onClose} tone="secondary" />
        </View>

        <View style={styles.cameraFrame}>
          <CameraView ref={cameraRef} style={styles.camera} facing="front" />
          <View style={styles.cameraOverlay} pointerEvents="none">
            <View style={styles.cameraGuide} />
          </View>
        </View>

        <Text style={styles.modalHint}>
          Face the camera directly in a bright area. The app submits one frame only.
        </Text>

        <ActionButton
          label={isBusy ? "Processing..." : "Take Photo"}
          onPress={onCapture}
          disabled={isBusy}
        />
      </SafeAreaView>
    </Modal>
  );
}

function HistoryItem({ record }) {
  return (
    <View style={styles.historyItem}>
      <View style={styles.historyHeader}>
        <Text style={styles.historyStatus}>{record.status.toUpperCase()}</Text>
        <Text style={styles.historyDate}>{formatDateTime(record.submittedAt)}</Text>
      </View>
      <Text style={styles.historyMeta}>Face score: {record.faceScore ?? "--"}</Text>
      <Text style={styles.historyMeta}>Liveness score: {record.livenessScore ?? "--"}</Text>
      <Text style={styles.historyMeta}>
        Geofence: {record.geoVerified ? "verified" : "not verified"}
      </Text>
    </View>
  );
}

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
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [screenMessage, setScreenMessage] = useState("");
  const [enrollmentStatus, setEnrollmentStatus] = useState({ status: "unknown" });
  const [currentWindow, setCurrentWindow] = useState(null);
  const [history, setHistory] = useState([]);
  const [attendanceJob, setAttendanceJob] = useState(null);
  const [captureMode, setCaptureMode] = useState(null);
  const [isCaptureBusy, setIsCaptureBusy] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function loadEnrollmentStatus() {
    const response = await authorizedRequest("/enrollment/status");
    setEnrollmentStatus(response);
    return response;
  }

  async function loadCurrentWindow() {
    const response = await authorizedRequest("/attendance/current-window");
    setCurrentWindow(response.data || null);
    return response.data || null;
  }

  async function loadHistory() {
    const response = await authorizedRequest("/attendance/my-history");
    setHistory(response.data || []);
    return response.data || [];
  }

  async function refreshDashboard(showLoader = true) {
    if (!isAuthenticated) {
      return;
    }

    if (showLoader) {
      setIsRefreshing(true);
    }

    try {
      await Promise.all([loadEnrollmentStatus(), loadCurrentWindow(), loadHistory()]);
    } catch (error) {
      setScreenMessage(normalizeErrorMessage(error));
    } finally {
      if (showLoader) {
        setIsRefreshing(false);
      }
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      setEnrollmentStatus({ status: "unknown" });
      setCurrentWindow(null);
      setHistory([]);
      setAttendanceJob(null);
      setScreenMessage("");
      return;
    }

    void refreshDashboard();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || enrollmentStatus.status !== "processing") {
      return undefined;
    }

    const intervalId = setInterval(() => {
      void loadEnrollmentStatus().catch(() => null);
    }, 2000);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, enrollmentStatus.status]);

  useEffect(() => {
    if (!isAuthenticated || !attendanceJob?.jobId || attendanceJob.status !== "pending") {
      return undefined;
    }

    const intervalId = setInterval(() => {
      void authorizedRequest(`/attendance/job/${attendanceJob.jobId}`)
        .then(async (response) => {
          setAttendanceJob(response);

          if (response.status !== "pending") {
            setScreenMessage(
              response.status === "verified"
                ? "Attendance verified successfully."
                : "Attendance verification finished with a non-verified status."
            );
            await loadHistory();
            await loadCurrentWindow();
          }
        })
        .catch((error) => {
          setScreenMessage(normalizeErrorMessage(error));
        });
    }, 2000);

    return () => clearInterval(intervalId);
  }, [authorizedRequest, attendanceJob?.jobId, attendanceJob?.status, isAuthenticated]);

  async function handleLogin(credentials) {
    setIsLoggingIn(true);

    try {
      await login(credentials);
      setScreenMessage("");
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function requestCameraAccess() {
    if (cameraPermission?.granted) {
      return true;
    }

    const permission = await requestCameraPermission();
    return permission.granted;
  }

  async function openCapture(mode) {
    setScreenMessage("");

    const hasPermission = await requestCameraAccess();

    if (!hasPermission) {
      setScreenMessage("Camera access is required to continue.");
      return;
    }

    setCaptureMode(mode);
  }

  async function submitEnrollment(uri) {
    const formData = new FormData();
    formData.append("image", {
      uri,
      name: `enrollment-${Date.now()}.jpg`,
      type: "image/jpeg"
    });

    await authorizedRequest("/enrollment/face", {
      method: "POST",
      body: formData
    });

    setEnrollmentStatus({
      status: "processing",
      updatedAt: new Date().toISOString()
    });
    setScreenMessage("Enrollment submitted. The template is being generated.");
  }

  async function submitAttendance(uri) {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (!permission.granted) {
      throw new Error("Location permission is required to mark attendance.");
    }

    await Location.enableNetworkProviderAsync().catch(() => null);
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest
    });

    if ((location.coords.accuracy || 999) > 30) {
      throw new Error("Location accuracy is too low. Move to an open area and try again.");
    }

    const formData = new FormData();
    formData.append("image", {
      uri,
      name: `attendance-${Date.now()}.jpg`,
      type: "image/jpeg"
    });
    formData.append("latitude", String(location.coords.latitude));
    formData.append("longitude", String(location.coords.longitude));
    formData.append("idempotency_key", createIdempotencyKey());

    try {
      const response = await authorizedRequest("/attendance/submit", {
        method: "POST",
        body: formData
      });

      setAttendanceJob(response);
      setScreenMessage("Attendance submitted. Verification is in progress.");
    } catch (error) {
      if (error.status === 409 && error.body?.jobId) {
        setAttendanceJob({
          jobId: error.body.jobId,
          status: error.body.status
        });
        setScreenMessage(error.body.message || "An attendance verification is already in progress.");
        return;
      }

      throw error;
    }
  }

  async function handleCapture() {
    if (!cameraRef.current || isCaptureBusy) {
      return;
    }

    setIsCaptureBusy(true);

    try {
      const picture = await cameraRef.current.takePictureAsync({
        quality: 0.7
      });

      if (!picture?.uri) {
        throw new Error("Camera capture failed. Please try again.");
      }

      const activeMode = captureMode;
      setCaptureMode(null);

      if (activeMode === "enrollment") {
        await submitEnrollment(picture.uri);
      } else if (activeMode === "attendance") {
        await submitAttendance(picture.uri);
      }
    } catch (error) {
      setScreenMessage(normalizeErrorMessage(error));
    } finally {
      setIsCaptureBusy(false);
    }
  }

  if (!isHydrated) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.loaderState}>
          <ActivityIndicator size="large" color="#ef8354" />
          <Text style={styles.loaderText}>Preparing student app...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginScreen
        preferredServerOrigin={preferredServerOrigin}
        onLogin={handleLogin}
        isSubmitting={isLoggingIn}
      />
    );
  }

  const latestHistoryRecord = history[0] || null;
  const enrollmentLabel =
    enrollmentStatus.status === "enrolled"
      ? `Enrolled (${enrollmentStatus.modelVersion || "template ready"})`
      : enrollmentStatus.status === "processing"
        ? "Enrollment processing"
        : enrollmentStatus.status === "re_enrollment_required"
          ? "Re-enrollment required"
          : "Not enrolled";

  const attendanceLabel = attendanceJob
    ? `${attendanceJob.status} ${attendanceJob.resolvedAt ? `• ${formatDateTime(attendanceJob.resolvedAt)}` : ""}`
    : latestHistoryRecord
      ? `${latestHistoryRecord.status} • ${formatDateTime(latestHistoryRecord.submittedAt)}`
      : "No attendance submissions yet";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <CaptureModal
        visible={Boolean(captureMode)}
        mode={captureMode}
        cameraRef={cameraRef}
        onClose={() => setCaptureMode(null)}
        onCapture={handleCapture}
        isBusy={isCaptureBusy}
      />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Student App</Text>
          <Text style={styles.heading}>Hostel Attendance Verification</Text>
          <Text style={styles.copy}>
            Submit attendance using a live camera frame and current GPS location. Session refresh is
            handled automatically while your app remains signed in.
          </Text>
          <View style={styles.heroActions}>
            <ActionButton
              label={isRefreshing ? "Refreshing..." : "Refresh"}
              onPress={() => refreshDashboard()}
              disabled={isRefreshing}
            />
            <ActionButton label="Log Out" onPress={logout} tone="secondary" />
          </View>
        </View>

        {screenMessage ? (
          <View style={styles.messageBanner}>
            <Text style={styles.messageText}>{screenMessage}</Text>
          </View>
        ) : null}

        <SectionCard
          title="Current Session"
          subtitle="Live student session and backend connection details."
        >
          <StatusCard label="Signed in as" value={`${user.name} (${user.role})`} tone="dark" />
          <StatusCard label="Server origin" value={session.serverOrigin} tone="light" />
          <StatusCard
            label="Enrollment"
            value={enrollmentLabel}
            tone={getEnrollmentTone(enrollmentStatus.status)}
          />
          <StatusCard
            label="Current window"
            value={
              currentWindow
                ? `${formatDateTime(currentWindow.opensAt)} to ${formatDateTime(currentWindow.closesAt)}`
                : "No active attendance window"
            }
            tone={currentWindow ? "accent" : "light"}
          />
        </SectionCard>

        <SectionCard
          title="Enrollment"
          subtitle="Capture a baseline face image when you are not enrolled or need to re-enroll."
          rightAction={
            <ActionButton
              label={
                enrollmentStatus.status === "processing" ? "Processing..." : "Capture Face"
              }
              onPress={() => openCapture("enrollment")}
              disabled={enrollmentStatus.status === "processing"}
            />
          }
        >
          <Text style={styles.sectionCopy}>
            The baseline image is sent to the backend, converted to an embedding, and the raw image
            is discarded after processing.
          </Text>
        </SectionCard>

        <SectionCard
          title="Mark Attendance"
          subtitle="Capture one live frame, attach GPS coordinates, and wait for verification."
          rightAction={
            <ActionButton
              label={
                attendanceJob?.status === "pending" ? "Verifying..." : "Mark Attendance"
              }
              onPress={() => openCapture("attendance")}
              disabled={attendanceJob?.status === "pending"}
            />
          }
        >
          <StatusCard
            label="Latest result"
            value={attendanceLabel}
            tone={getAttendanceTone(attendanceJob?.status || latestHistoryRecord?.status)}
          />
          <Text style={styles.sectionCopy}>
            The app rejects low-accuracy GPS fixes above 30 metres before submitting attendance.
          </Text>
        </SectionCard>

        <SectionCard
          title="My History"
          subtitle="Recent attendance records pulled directly from the backend."
        >
          {history.length === 0 ? (
            <Text style={styles.emptyHistory}>
              No attendance history yet. Your verified or overridden records will show up here.
            </Text>
          ) : (
            history.map((record) => <HistoryItem key={record.id} record={record} />)
          )}
        </SectionCard>
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
    gap: 18
  },
  loginContainer: {
    padding: 20,
    gap: 18
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
  heroActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8
  },
  sectionCard: {
    backgroundColor: "#f7fbfc",
    borderRadius: 24,
    padding: 18,
    gap: 14
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  sectionHeaderText: {
    flex: 1,
    gap: 4
  },
  sectionTitle: {
    color: "#0f2d3c",
    fontSize: 20,
    fontWeight: "700"
  },
  sectionSubtitle: {
    color: "#5c677d",
    fontSize: 14,
    lineHeight: 20
  },
  sectionBody: {
    gap: 12
  },
  sectionCopy: {
    color: "#43515b",
    fontSize: 14,
    lineHeight: 20
  },
  actionButton: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButton: {
    backgroundColor: "#ef8354"
  },
  secondaryButton: {
    backgroundColor: "#d9e4ea"
  },
  primaryButtonText: {
    color: "#081f29"
  },
  secondaryButtonText: {
    color: "#0f2d3c"
  },
  actionButtonText: {
    fontWeight: "700"
  },
  buttonPressed: {
    opacity: 0.88
  },
  buttonDisabled: {
    opacity: 0.5
  },
  messageBanner: {
    backgroundColor: "#d8f3dc",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  messageText: {
    color: "#1b4332",
    fontSize: 14,
    lineHeight: 20
  },
  fieldLabel: {
    color: "#0f2d3c",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6
  },
  input: {
    borderColor: "#d0dbe1",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    color: "#0f2d3c"
  },
  inputHint: {
    color: "#5c677d",
    fontSize: 12,
    lineHeight: 18,
    marginTop: -4,
    marginBottom: 4
  },
  inlineButtons: {
    marginTop: 10
  },
  errorText: {
    color: "#b42318",
    fontSize: 14,
    lineHeight: 20
  },
  loaderState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12
  },
  loaderText: {
    color: "#f7fbfc",
    fontSize: 16
  },
  modalRoot: {
    flex: 1,
    backgroundColor: "#081f29",
    padding: 20,
    gap: 16
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  modalEyebrow: {
    color: "#8ed1c4",
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase"
  },
  modalTitle: {
    color: "#f7fbfc",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 4
  },
  cameraFrame: {
    flex: 1,
    borderRadius: 28,
    overflow: "hidden",
    position: "relative"
  },
  camera: {
    flex: 1
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center"
  },
  cameraGuide: {
    width: "72%",
    aspectRatio: 0.78,
    borderWidth: 3,
    borderColor: "#ffffff",
    borderRadius: 32
  },
  modalHint: {
    color: "#c8d9df",
    fontSize: 14,
    lineHeight: 20
  },
  emptyHistory: {
    color: "#5c677d",
    fontSize: 14,
    lineHeight: 20
  },
  historyItem: {
    borderRadius: 20,
    backgroundColor: "#eaf1f4",
    padding: 14,
    gap: 4
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center"
  },
  historyStatus: {
    color: "#0f2d3c",
    fontSize: 12,
    fontWeight: "700"
  },
  historyDate: {
    color: "#5c677d",
    fontSize: 12
  },
  historyMeta: {
    color: "#43515b",
    fontSize: 13
  }
});
