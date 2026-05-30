import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import styles from "../styles";
import StatusCard from "../components/StatusCard";
import ActionButton from "../components/ActionButton";
import SectionCard from "../components/SectionCard";
import CaptureModal from "./CaptureModal";
import HistoryItem from "./HistoryItem";
import {
  createIdempotencyKey,
  formatDateTime,
  normalizeErrorMessage,
  getEnrollmentTone,
  getAttendanceTone
} from "../utils/helpers";

// Gorgeous double-sided dynamic Resident ID Card
function DigitalIDCard({ user, session, flipped, onFlip }) {
  return (
    <Pressable onPress={onFlip} style={styles.idCardOuter}>
      {!flipped ? (
        <View style={styles.idCardContainer}>
          {/* Hologram aesthetic card details */}
          <View style={styles.idCardGlow} />
          <View style={styles.idCardHeader}>
            <View style={styles.idCardHeaderLeft}>
              <MaterialCommunityIcons name="shield-account-outline" size={20} color="#06B6D4" />
              <Text style={styles.idCardTitle}>RESIDENT PASS</Text>
            </View>
            <View style={styles.idCardStatusBadge}>
              <View style={styles.statusDotLive} />
              <Text style={styles.idCardStatusText}>ACTIVE</Text>
            </View>
          </View>

          <View style={styles.idCardBody}>
            <View style={styles.idCardAvatarContainer}>
              <View style={styles.idCardAvatarFrame}>
                <Ionicons name="person-circle-outline" size={54} color="#22D3EE" />
                <View style={styles.idCardAvatarHUD} />
              </View>
            </View>

            <View style={styles.idCardMeta}>
              <Text style={styles.idCardLabel}>RESIDENT NAME</Text>
              <Text style={styles.idCardName}>{user.name.toUpperCase()}</Text>

              <Text style={styles.idCardLabel}>IDENTIFICATION UID</Text>
              <Text style={styles.idCardUid}>{user.id.slice(0, 13).toUpperCase()}</Text>

              <View style={styles.idCardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.idCardLabel}>ROLE</Text>
                  <Text style={styles.idCardVal}>{user.role.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.idCardLabel}>HOSTEL</Text>
                  <Text style={styles.idCardVal}>CAMPUS BLOCK A</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.idCardFooter}>
            <View style={barcodeContainerStyle()}>
              {[3, 1, 4, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 4, 2, 2, 1, 3, 4, 1, 2].map((w, i) => (
                <View key={i} style={{ width: w, height: 26, backgroundColor: "rgba(6, 182, 212, 0.4)", marginRight: 2 }} />
              ))}
            </View>
            <Text style={styles.idCardTapPrompt}>TAP CARD TO FLIP</Text>
          </View>
        </View>
      ) : (
        <View style={styles.idCardContainerBack}>
          <View style={styles.idCardGlowBack} />
          <Text style={styles.backCardTitle}>SYSTEM COMPLIANCE DETAILS</Text>
          
          <View style={styles.backCardMetaItem}>
            <Text style={styles.backCardLabel}>EMERGENCY CONTACTS</Text>
            <Text style={styles.backCardVal}>Warden Desk: ext 8092</Text>
            <Text style={styles.backCardVal}>Campus Security: ext 5055</Text>
          </View>

          <View style={styles.backCardWarningBox}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#06B6D4" style={{ marginBottom: 4 }} />
            <Text style={styles.backCardWarningText}>
              This digital pass uses dynamic biometric validation. GPS coordinate matching and face telemetry checks are logged per window.
            </Text>
          </View>

          <Text style={styles.idCardTapPrompt}>TAP CARD TO ROTATE</Text>
        </View>
      )}
    </Pressable>
  );
}

function barcodeContainerStyle() {
  return styles.barcodeContainer || { flexDirection: "row", alignItems: "center" };
}

export default function DashboardScreen({ user, session, authorizedRequest, logout }) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [screenMessage, setScreenMessage] = useState("");
  const [enrollmentStatus, setEnrollmentStatus] = useState({ status: "unknown" });
  const [currentWindow, setCurrentWindow] = useState(null);
  const [history, setHistory] = useState([]);
  const [attendanceJob, setAttendanceJob] = useState(null);
  const [captureMode, setCaptureMode] = useState(null);
  const [isCaptureBusy, setIsCaptureBusy] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, history, id
  const [idCardFlipped, setIdCardFlipped] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("all"); // all, verified, pending, failed

  // Live Location Telemetry State
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);

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
    void refreshDashboard();

    const intervalId = setInterval(() => {
      void loadCurrentWindow().catch(() => null);
    }, 10000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (enrollmentStatus.status !== "processing") {
      return undefined;
    }

    const intervalId = setInterval(() => {
      void loadEnrollmentStatus().catch(() => null);
    }, 2000);

    return () => clearInterval(intervalId);
  }, [enrollmentStatus.status]);

  useEffect(() => {
    if (!attendanceJob?.jobId || attendanceJob.status !== "pending") {
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
  }, [authorizedRequest, attendanceJob?.jobId, attendanceJob?.status]);

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
    setScreenMessage("Enrollment submitted. Synthesizing secure face templates...");
  }

  async function submitAttendance(uri) {
    setGpsLoading(true);
    setGpsAccuracy(null);
    setScreenMessage("Locking GPS coordinates...");

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        throw new Error("Location permission is required to mark attendance.");
      }

      await Location.enableNetworkProviderAsync().catch(() => null);
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      setGpsAccuracy(location.coords.accuracy);
      setGpsLoading(false);

      if ((location.coords.accuracy || 999) > 30) {
        throw new Error(`Location accuracy (${Math.round(location.coords.accuracy)}m) too low. Step outside and re-try.`);
      }

      setScreenMessage("Uploading biometrics & location payload...");
      const formData = new FormData();
      formData.append("image", {
        uri,
        name: `attendance-${Date.now()}.jpg`,
        type: "image/jpeg"
      });
      formData.append("latitude", String(location.coords.latitude));
      formData.append("longitude", String(location.coords.longitude));
      formData.append("idempotency_key", createIdempotencyKey());

      const response = await authorizedRequest("/attendance/submit", {
        method: "POST",
        body: formData
      });

      setAttendanceJob(response);
      setScreenMessage("Biometrics processing. Waiting for matrix confirmation...");
    } catch (error) {
      setGpsLoading(false);
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

  const latestHistoryRecord = history[0] || null;
  const enrollmentLabel =
    enrollmentStatus.status === "enrolled"
      ? `Registered (${enrollmentStatus.modelVersion || "verified SHA-256"})`
      : enrollmentStatus.status === "processing"
        ? "Processing vector..."
        : enrollmentStatus.status === "re_enrollment_required"
          ? "Action Required: Re-enroll Face"
          : "Not Registered";

  const attendanceLabel = attendanceJob
    ? `${attendanceJob.status.toUpperCase()} ${attendanceJob.resolvedAt ? `• ${formatDateTime(attendanceJob.resolvedAt)}` : ""}`
    : latestHistoryRecord
      ? `${latestHistoryRecord.status.toUpperCase()} • ${formatDateTime(latestHistoryRecord.submittedAt)}`
      : "No secure logs found";

  // Filter history logs dynamically based on select chip
  const filteredHistory = history.filter((record) => {
    if (historyFilter === "all") return true;
    return record.status === historyFilter;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      
      {/* HUD Camera viewmodal */}
      <CaptureModal
        visible={Boolean(captureMode)}
        mode={captureMode}
        cameraRef={cameraRef}
        onClose={() => setCaptureMode(null)}
        onCapture={handleCapture}
        isBusy={isCaptureBusy}
      />

      <View style={styles.appShellRoot}>
        {/* Home Telemetry Dashboard Screen */}
        {activeTab === "dashboard" ? (
          <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.hero}>
              <View style={styles.heroHeader}>
                <View>
                  <Text style={styles.eyebrow}>TACTICAL RESIDENT MONITOR</Text>
                  <Text style={styles.heading}>{user.name.split(" ")[0]}'s Portal</Text>
                </View>
                <Pressable onPress={() => refreshDashboard()} disabled={isRefreshing} style={styles.refreshBadge}>
                  <Ionicons name={isRefreshing ? "sync" : "refresh-outline"} size={16} color="#06B6D4" style={isRefreshing ? styles.refreshSpinning : null} />
                  <Text style={styles.refreshBadgeText}>{isRefreshing ? "SYNCING..." : "SYNC"}</Text>
                </Pressable>
              </View>
              <Text style={styles.copy}>
                Synchronized telemetry matches location metrics and biometric arrays against scheduled attendance windows.
              </Text>
              
              <View style={styles.heroActions}>
                <ActionButton 
                  label="SHUT DOWN SESSION" 
                  onPress={logout} 
                  tone="secondary" 
                  icon={<Ionicons name="power-outline" size={16} color="#cbd5e1" />}
                />
              </View>
            </View>

            {screenMessage ? (
              <View style={[styles.messageBanner, gpsLoading ? styles.messageBannerGps : null]}>
                {gpsLoading ? <ActivityIndicator size="small" color="#06B6D4" style={{ marginRight: 8 }} /> : <Ionicons name="information-circle" size={20} color="#0891b2" style={{ marginRight: 8 }} />}
                <Text style={styles.messageText}>{screenMessage}</Text>
              </View>
            ) : null}

            {gpsAccuracy !== null ? (
              <View style={[styles.messageBanner, gpsAccuracy <= 30 ? styles.gpsGood : styles.gpsBad]}>
                <Ionicons name={gpsAccuracy <= 30 ? "location" : "location-outline"} size={18} color={gpsAccuracy <= 30 ? "#34d399" : "#f87171"} style={{ marginRight: 6 }} />
                <Text style={[styles.messageText, { color: gpsAccuracy <= 30 ? "#a7f3d0" : "#fca5a5" }]}>
                  GPS Precision: {Math.round(gpsAccuracy)}m {gpsAccuracy <= 30 ? "(Valid range locked)" : "(Exceeds 30m boundary tolerance)"}
                </Text>
              </View>
            ) : null}



            <SectionCard
              title="Biometric Matrix Registration"
              subtitle="Register a secure, encrypted facial template hash."
              icon={<MaterialCommunityIcons name="face-recognition" size={18} color="#06B6D4" />}
              rightAction={
                <ActionButton
                  label={
                    enrollmentStatus.status === "processing"
                      ? "ENROLLING..."
                      : enrollmentStatus.status === "enrolled"
                        ? "ENROLLED"
                        : "REGISTER FACE"
                  }
                  onPress={() => openCapture("enrollment")}
                  disabled={
                    enrollmentStatus.status === "processing" ||
                    enrollmentStatus.status === "enrolled"
                  }
                  icon={<Ionicons name="scan" size={16} color="#081f29" />}
                />
              }
            >
              <StatusCard
                label="REGISTRATION STATUS"
                value={enrollmentLabel}
                tone={
                  enrollmentStatus.status === "enrolled"
                    ? "success"
                    : enrollmentStatus.status === "processing"
                      ? "accent"
                      : enrollmentStatus.status === "re_enrollment_required"
                        ? "danger"
                        : "light"
                }
              />
              <View style={{ height: 8 }} />
              <Text style={styles.sectionCopy}>
                The registered photo is converted to a vector embedding. High-security encryption stores the hash; raw pixel data is deleted post-computation.
              </Text>
            </SectionCard>

            <SectionCard
              title="Secure Attendance Verification"
              subtitle="Verify live location and face biometrics."
              icon={<Ionicons name="shield-checkmark-outline" size={18} color="#06B6D4" />}
              rightAction={
                <ActionButton
                  label={attendanceJob?.status === "pending" ? "VERIFYING..." : "MARK ATTENDANCE"}
                  onPress={() => openCapture("attendance")}
                  disabled={attendanceJob?.status === "pending" || enrollmentStatus.status !== "enrolled" || !currentWindow}
                  icon={<Ionicons name="finger-print-outline" size={16} color="#081f29" />}
                />
              }
            >
              <StatusCard
                label="ATTENDANCE WINDOW"
                value={currentWindow ? "OPEN - ACCEPTING BIOMETRICS" : "CLOSED - CHECK BACK LATER"}
                tone={currentWindow ? "accent" : "light"}
              />
              <View style={{ height: 8 }} />
              <StatusCard
                label="LATEST VERIFICATION ATTEMPT"
                value={attendanceLabel}
                tone={getAttendanceTone(attendanceJob?.status || latestHistoryRecord?.status)}
              />
              <Text style={styles.sectionCopy}>
                Requires location accuracy &lt; 30 metres. If attendance fails, contact your campus warden to submit an admin override.
              </Text>
            </SectionCard>
          </ScrollView>
        ) : null}

        {/* History Logs Scroll Tab */}
        {activeTab === "history" ? (
          <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.historyHeaderSection}>
              <Text style={styles.historySectionTitle}>Secure Audit Logs</Text>
              <Text style={styles.historySectionSubtitle}>
                Verified biometric history fetched from authorized gateway.
              </Text>
            </View>

            {/* High-craft Filter Chips */}
            <View style={styles.filterChipsRow}>
              {["all", "verified", "pending", "failed"].map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setHistoryFilter(f)}
                  style={[
                    styles.filterChip,
                    historyFilter === f ? styles.filterChipActive : null
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      historyFilter === f ? styles.filterChipTextActive : null
                    ]}
                  >
                    {f.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.historyListContainer}>
              {filteredHistory.length === 0 ? (
                <View style={styles.emptyHistoryBox}>
                  <Ionicons name="document-text-outline" size={32} color="#475569" style={{ marginBottom: 8 }} />
                  <Text style={styles.emptyHistory}>
                    No logs found matching the selected query filters.
                  </Text>
                </View>
              ) : (
                filteredHistory.map((record) => <HistoryItem key={record.id} record={record} />)
              )}
            </View>
          </ScrollView>
        ) : null}

        {/* Digital ID Hologram Tab */}
        {activeTab === "id" ? (
          <View style={[styles.container, styles.idCardTabContainer]}>
            <View style={styles.historyHeaderSection}>
              <Text style={styles.historySectionTitle}>Resident Credentials</Text>
              <Text style={styles.historySectionSubtitle}>
                Present this cryptographically verified pass at any security gateway.
              </Text>
            </View>

            <DigitalIDCard 
              user={user} 
              session={session} 
              flipped={idCardFlipped} 
              onFlip={() => {
                setIdCardFlipped(!idCardFlipped);
              }}
            />
          </View>
        ) : null}

        {/* Dynamic bottom tab nav */}
        <View style={styles.tabBar}>
          <Pressable
            onPress={() => setActiveTab("dashboard")}
            style={styles.tabItem}
          >
            <Ionicons
              name={activeTab === "dashboard" ? "speedometer" : "speedometer-outline"}
              size={22}
              color={activeTab === "dashboard" ? "#06B6D4" : "#94a3b8"}
            />
            <Text style={[styles.tabLabel, activeTab === "dashboard" ? styles.tabLabelActive : null]}>
              HUD
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("history")}
            style={styles.tabItem}
          >
            <Ionicons
              name={activeTab === "history" ? "document-text" : "document-text-outline"}
              size={22}
              color={activeTab === "history" ? "#06B6D4" : "#94a3b8"}
            />
            <Text style={[styles.tabLabel, activeTab === "history" ? styles.tabLabelActive : null]}>
              LOGS
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("id")}
            style={styles.tabItem}
          >
            <Ionicons
              name={activeTab === "id" ? "card" : "card-outline"}
              size={22}
              color={activeTab === "id" ? "#06B6D4" : "#94a3b8"}
            />
            <Text style={[styles.tabLabel, activeTab === "id" ? styles.tabLabelActive : null]}>
              PASS
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
