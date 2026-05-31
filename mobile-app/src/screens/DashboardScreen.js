import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
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
import LeaveRequestItem from "../components/LeaveRequestItem";
import {
  createIdempotencyKey,
  formatDateTime,
  normalizeErrorMessage,
  getEnrollmentTone,
  getAttendanceTone
} from "../utils/helpers";
import {
  getWindowNotificationMessage,
  getWindowOpenedNotification
} from "../utils/windowNotifications";
import { getVerificationResultMessage } from "../utils/attendanceMessages";
import { getBestLocationFix, MAX_GPS_ACCURACY_METRES } from "../utils/location";
import {
  buildLeaveRequestPayload,
  getLeaveRequestValidationMessage
} from "../utils/studentPortal";

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

              <Text style={styles.idCardLabel}>REGISTERED STUDENT ID</Text>
              <Text selectable style={styles.idCardUid}>{user.id.toUpperCase()}</Text>

              <View style={styles.idCardRow}>
                <View style={styles.idCardInfoColumn}>
                  <Text style={styles.idCardLabel}>ROLE</Text>
                  <Text style={styles.idCardVal}>{user.role.toUpperCase()}</Text>
                </View>
                <View style={styles.idCardInfoColumn}>
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
          <Text style={styles.backCardTitle}>CAMPUS ACCESS DETAILS</Text>
          
          <View style={styles.backCardMetaItem}>
            <Text style={styles.backCardLabel}>EMERGENCY CONTACTS</Text>
            <Text style={styles.backCardVal}>Warden Desk: ext 8092</Text>
            <Text style={styles.backCardVal}>Campus Security: ext 5055</Text>
          </View>

          <View style={styles.backCardWarningBox}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#06B6D4" style={{ marginBottom: 4 }} />
            <Text style={styles.backCardWarningText}>
              This pass is linked to your active student account and attendance verification history.
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
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [attendanceJob, setAttendanceJob] = useState(null);
  const [captureMode, setCaptureMode] = useState(null);
  const [isCaptureBusy, setIsCaptureBusy] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLeaveRefreshing, setIsLeaveRefreshing] = useState(false);
  const [isLeaveSubmitting, setIsLeaveSubmitting] = useState(false);
  const [hasLoadedLeaveRequests, setHasLoadedLeaveRequests] = useState(false);
  const [leaveFormError, setLeaveFormError] = useState("");
  const [leaveDraft, setLeaveDraft] = useState({
    requestedFrom: "",
    requestedTo: "",
    destination: "",
    reason: ""
  });
  const currentWindowRef = useRef(null);
  const hasLoadedCurrentWindowRef = useRef(false);

  // Tab State
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, leave, history, id
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
    const nextWindow = response.data || null;
    const notification = getWindowOpenedNotification({
      hasLoadedCurrentWindow: hasLoadedCurrentWindowRef.current,
      previousWindow: currentWindowRef.current,
      nextWindow
    });

    currentWindowRef.current = nextWindow;
    hasLoadedCurrentWindowRef.current = true;
    setCurrentWindow(nextWindow);

    if (notification) {
      setScreenMessage(notification);
    }

    return nextWindow;
  }

  async function loadHistory() {
    const response = await authorizedRequest("/attendance/my-history");
    const records = response.data || [];
    setHistory(records);
    setAttendanceJob((currentJob) => {
      if (!currentJob?.jobId) {
        return currentJob;
      }

      const matchingRecord = records.find((record) => record.jobId === currentJob.jobId);
      if (matchingRecord) {
        return matchingRecord;
      }

      if (currentJob.status !== "pending" && records[0]?.jobId !== currentJob.jobId) {
        return null;
      }

      return currentJob;
    });
    return records;
  }

  async function loadLeaveRequests({ showLoader = false } = {}) {
    if (showLoader) {
      setIsLeaveRefreshing(true);
    }

    try {
      const response = await authorizedRequest("/leaves");
      const records = response.data || [];
      setLeaveRequests(records);
      setHasLoadedLeaveRequests(true);
      return records;
    } finally {
      if (showLoader) {
        setIsLeaveRefreshing(false);
      }
    }
  }

  async function loadUnreadNotifications() {
    const response = await authorizedRequest("/notifications/unread");
    const notifications = response.data || [];
    const windowNotification = notifications.find((notification) => notification.type === "attendance_window_opened");

    if (windowNotification) {
      const message = getWindowNotificationMessage(windowNotification);
      if (message) {
        setScreenMessage(message);
      }

      await authorizedRequest(`/notifications/${windowNotification.id}/read`, {
        method: "PATCH"
      }).catch(() => null);
    }

    return notifications;
  }

  async function refreshDashboard(showLoader = true) {
    if (showLoader) {
      setIsRefreshing(true);
    }

    try {
      await Promise.all([
        loadEnrollmentStatus(),
        loadCurrentWindow(),
        loadHistory(),
        loadLeaveRequests(),
        loadUnreadNotifications()
      ]);
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
      void Promise.all([loadCurrentWindow(), loadUnreadNotifications()]).catch(() => null);
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
            setScreenMessage(getVerificationResultMessage(response));
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
    setScreenMessage("Face registration submitted. We will update the status shortly.");
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

      const location = await getBestLocationFix(Location, {
        onFix: (fix, { attempt, attempts }) => {
          console.log("[GPS] fix", {
            attempt,
            attempts,
            latitude: fix.latitude,
            longitude: fix.longitude,
            accuracyMetres: fix.accuracy
          });
          setGpsAccuracy(fix.accuracy);
          setScreenMessage(
            `GPS fix ${attempt}/${attempts}: ${Math.round(fix.accuracy)}m at ${fix.latitude.toFixed(6)}, ${fix.longitude.toFixed(6)}`
          );
        }
      });
      const accuracy = location.accuracy;

      setGpsAccuracy(accuracy);
      setGpsLoading(false);

      if (accuracy > MAX_GPS_ACCURACY_METRES) {
        throw new Error(`Location accuracy (${Math.round(accuracy)}m) too low. Step outside and re-try.`);
      }

      setScreenMessage("Uploading face and location check...");
      console.log("[Attendance] submitting coordinates", {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracyMetres: accuracy
      });
      const formData = new FormData();
      formData.append("image", {
        uri,
        name: `attendance-${Date.now()}.jpg`,
        type: "image/jpeg"
      });
      formData.append("latitude", String(location.latitude));
      formData.append("longitude", String(location.longitude));
      formData.append("accuracy_metres", String(accuracy));
      formData.append("idempotency_key", createIdempotencyKey());

      const response = await authorizedRequest("/attendance/submit", {
        method: "POST",
        body: formData
      });

      setAttendanceJob(response);
      setScreenMessage("Attendance verification is processing. We will update this screen when it finishes.");
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

  function updateLeaveDraft(field, value) {
    setLeaveDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
  }

  async function submitLeaveRequest() {
    const validationMessage = getLeaveRequestValidationMessage(leaveDraft);

    if (validationMessage) {
      setLeaveFormError(validationMessage);
      return;
    }

    setLeaveFormError("");
    setIsLeaveSubmitting(true);

    try {
      await authorizedRequest("/leaves", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildLeaveRequestPayload(leaveDraft))
      });

      setLeaveDraft({
        requestedFrom: "",
        requestedTo: "",
        destination: "",
        reason: ""
      });
      await loadLeaveRequests();
      setScreenMessage("Leave request submitted and routed to your linked parent account.");
    } catch (error) {
      setLeaveFormError(normalizeErrorMessage(error));
    } finally {
      setIsLeaveSubmitting(false);
    }
  }

  const latestHistoryRecord = history[0] || null;
  const pendingLeaveCount = leaveRequests.filter((request) => request.status === "pending").length;
  const enrollmentLabel =
    enrollmentStatus.status === "enrolled"
      ? `Registered (${enrollmentStatus.modelVersion || "verified SHA-256"})`
      : enrollmentStatus.status === "processing"
        ? "Processing..."
        : enrollmentStatus.status === "re_enrollment_required"
          ? "Action Required: Re-enroll Face"
          : "Not Registered";

  const attendanceLabel = attendanceJob
    ? `${attendanceJob.status.toUpperCase()} ${attendanceJob.resolvedAt ? `- ${formatDateTime(attendanceJob.resolvedAt)}` : ""}`
    : latestHistoryRecord
      ? `${latestHistoryRecord.status.toUpperCase()} - ${formatDateTime(latestHistoryRecord.submittedAt)}`
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
        {screenMessage ? (
          <View style={[styles.messageBanner, styles.shellMessageBanner, gpsLoading ? styles.messageBannerGps : null]}>
            {gpsLoading ? <ActivityIndicator size="small" color="#06B6D4" style={{ marginRight: 8 }} /> : <Ionicons name="information-circle" size={20} color="#0891b2" style={{ marginRight: 8 }} />}
            <Text style={styles.messageText}>{screenMessage}</Text>
          </View>
        ) : null}

        {/* Home Telemetry Dashboard Screen */}
        {activeTab === "dashboard" ? (
          <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.hero}>
              <View style={styles.heroHeader}>
                <View>
                  <Text style={styles.eyebrow}>RESIDENT DASHBOARD</Text>
                  <Text style={styles.heading}>Hi, {user.name.split(" ")[0]}</Text>
                </View>
                <Pressable onPress={() => refreshDashboard()} disabled={isRefreshing} style={styles.refreshBadge}>
                  <Ionicons name={isRefreshing ? "sync" : "refresh-outline"} size={16} color="#06B6D4" style={isRefreshing ? styles.refreshSpinning : null} />
                  <Text style={styles.refreshBadgeText}>{isRefreshing ? "SYNCING..." : "SYNC"}</Text>
                </Pressable>
              </View>
              <Text style={styles.copy}>
                Track attendance windows, face registration, leave requests, and your resident pass.
              </Text>
              
              <View style={styles.heroActions}>
                <ActionButton 
                  label="SIGN OUT"
                  onPress={logout} 
                  tone="secondary" 
                  icon={<Ionicons name="power-outline" size={16} color="#cbd5e1" />}
                />
              </View>
            </View>

            {gpsAccuracy !== null ? (
              <View style={[styles.messageBanner, gpsAccuracy <= 30 ? styles.gpsGood : styles.gpsBad]}>
                <Ionicons name={gpsAccuracy <= 30 ? "location" : "location-outline"} size={18} color={gpsAccuracy <= 30 ? "#34d399" : "#f87171"} style={{ marginRight: 6 }} />
                <Text style={[styles.messageText, { color: gpsAccuracy <= 30 ? "#a7f3d0" : "#fca5a5" }]}>
                  GPS Precision: {Math.round(gpsAccuracy)}m {gpsAccuracy <= 30 ? "(Valid range locked)" : "(Exceeds 30m boundary tolerance)"}
                </Text>
              </View>
            ) : null}



            <SectionCard
              title="Face Registration"
              subtitle="Register your face once before marking attendance."
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
                label="FACE STATUS"
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
              <View style={styles.spacerSmall} />
              <Text style={styles.sectionCopy}>
                Keep your face registration current so attendance checks stay fast and reliable.
              </Text>
            </SectionCard>

            <SectionCard
              title="Attendance Check"
              subtitle="Mark attendance during an open hostel window."
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
                label="CURRENT WINDOW"
                value={currentWindow ? "OPEN - READY" : "CLOSED - CHECK BACK LATER"}
                tone={currentWindow ? "accent" : "light"}
              />
              <View style={styles.spacerSmall} />
              <StatusCard
                label="LATEST ATTEMPT"
                value={attendanceLabel}
                tone={getAttendanceTone(attendanceJob?.status || latestHistoryRecord?.status)}
              />
              <Text style={styles.sectionCopy}>
                Requires location accuracy within 30 metres. If a valid attempt fails, contact your hostel warden.
              </Text>
            </SectionCard>
          </ScrollView>
        ) : null}

        {/* Leave Request Tab */}
        {activeTab === "leave" ? (
          <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.historyHeaderSection}>
              <Text style={styles.historySectionTitle}>Leave Desk</Text>
              <Text style={styles.historySectionSubtitle}>
                Submit leave windows for parent approval and track each request without leaving the student app.
              </Text>
            </View>

            <SectionCard
              title="Request New Leave"
              subtitle={
                pendingLeaveCount > 0
                  ? `${pendingLeaveCount} request${pendingLeaveCount === 1 ? "" : "s"} waiting on parent review.`
                  : "Linked parent approval is required before leave can be approved."
              }
              icon={<Ionicons name="airplane-outline" size={18} color="#06B6D4" />}
            >
              <View style={styles.leaveFormRow}>
                <View style={styles.leaveFieldColumn}>
                  <Text style={styles.fieldLabel}>Departure Date</Text>
                  <TextInput
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="numbers-and-punctuation"
                    value={leaveDraft.requestedFrom}
                    onChangeText={(value) => updateLeaveDraft("requestedFrom", value)}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#475569"
                  />
                </View>
                <View style={styles.leaveFieldColumn}>
                  <Text style={styles.fieldLabel}>Return Date</Text>
                  <TextInput
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="numbers-and-punctuation"
                    value={leaveDraft.requestedTo}
                    onChangeText={(value) => updateLeaveDraft("requestedTo", value)}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#475569"
                  />
                </View>
              </View>
              <Text style={styles.inputHint}>
                Use YYYY-MM-DD for both dates.
              </Text>

              <Text style={styles.fieldLabel}>Destination</Text>
              <TextInput
                style={styles.input}
                autoCapitalize="words"
                autoCorrect={false}
                value={leaveDraft.destination}
                onChangeText={(value) => updateLeaveDraft("destination", value)}
                placeholder="Chandigarh"
                placeholderTextColor="#475569"
              />

              <Text style={styles.fieldLabel}>Reason</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                autoCapitalize="sentences"
                autoCorrect
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={leaveDraft.reason}
                onChangeText={(value) => updateLeaveDraft("reason", value)}
                placeholder="Briefly explain why you need leave."
                placeholderTextColor="#475569"
              />

              {leaveFormError ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle-outline" size={18} color="#f87171" style={{ marginRight: 6 }} />
                  <Text style={styles.errorText}>{leaveFormError}</Text>
                </View>
              ) : null}

              <ActionButton
                label={isLeaveSubmitting ? "SUBMITTING..." : "SEND FOR APPROVAL"}
                onPress={submitLeaveRequest}
                disabled={isLeaveSubmitting}
                icon={
                  isLeaveSubmitting ? (
                    <ActivityIndicator size="small" color="#081f29" />
                  ) : (
                    <Ionicons name="send-outline" size={16} color="#081f29" />
                  )
                }
              />
            </SectionCard>

            <SectionCard
              title="Your Leave Requests"
              subtitle="Statuses update here after your parent reviews them."
              icon={<Ionicons name="file-tray-full-outline" size={18} color="#06B6D4" />}
              rightAction={
                <ActionButton
                  label={isLeaveRefreshing ? "SYNCING..." : "SYNC"}
                  onPress={() => loadLeaveRequests({ showLoader: true }).catch((error) => {
                    setScreenMessage(normalizeErrorMessage(error));
                  })}
                  disabled={isLeaveRefreshing}
                  tone="secondary"
                  icon={
                    isLeaveRefreshing ? (
                      <ActivityIndicator size="small" color="#cbd5e1" />
                    ) : (
                      <Ionicons name="refresh-outline" size={16} color="#cbd5e1" />
                    )
                  }
                />
              }
            >
              {!hasLoadedLeaveRequests && isRefreshing ? (
                <View style={styles.leaveLoadingState}>
                  <ActivityIndicator size="small" color="#06B6D4" />
                  <Text style={styles.sectionCopy}>Loading leave requests...</Text>
                </View>
              ) : leaveRequests.length === 0 ? (
                <View style={styles.emptyHistoryBox}>
                  <Ionicons name="airplane-outline" size={32} color="#475569" style={{ marginBottom: 8 }} />
                  <Text style={styles.emptyHistory}>
                    No leave requests submitted yet.
                  </Text>
                </View>
              ) : (
                <View style={styles.leaveRequestList}>
                  {leaveRequests.map((request) => (
                    <LeaveRequestItem key={request.id} request={request} />
                  ))}
                </View>
              )}
            </SectionCard>
          </ScrollView>
        ) : null}

        {/* History Logs Scroll Tab */}
        {activeTab === "history" ? (
          <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.historyHeaderSection}>
              <Text style={styles.historySectionTitle}>Secure Audit Logs</Text>
              <Text style={styles.historySectionSubtitle}>
                Review your recent attendance attempts and verification results.
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
                Use this pass when hostel staff need to confirm your student account.
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
            onPress={() => setActiveTab("leave")}
            style={styles.tabItem}
          >
            <Ionicons
              name={activeTab === "leave" ? "airplane" : "airplane-outline"}
              size={22}
              color={activeTab === "leave" ? "#06B6D4" : "#94a3b8"}
            />
            <Text style={[styles.tabLabel, activeTab === "leave" ? styles.tabLabelActive : null]}>
              LEAVE
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
