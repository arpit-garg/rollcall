import { StyleSheet, Platform } from "react-native";

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#060B0E"
  },
  appShellRoot: {
    flex: 1,
    justifyContent: "space-between"
  },
  container: {
    padding: 16,
    gap: 16
  },
  loginContainer: {
    paddingHorizontal: 20,
    paddingVertical: 32,
    gap: 20
  },
  loginHero: {
    alignItems: "center",
    marginBottom: 8,
    gap: 8
  },
  loginLogoContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(6, 182, 212, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8
  },
  loginLogoPulse: {
    alignItems: "center",
    justifyContent: "center"
  },
  loginEyebrow: {
    color: "#06B6D4",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    textAlign: "center"
  },
  loginHeading: {
    color: "#f8fafc",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    textAlign: "center"
  },
  loginCopy: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: 12
  },
  hero: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    padding: 20,
    gap: 12
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  eyebrow: {
    color: "#06B6D4",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2
  },
  heading: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginTop: 2
  },
  copy: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 18
  },
  heroActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4
  },
  refreshBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(6, 182, 212, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.2)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6
  },
  refreshBadgeText: {
    color: "#22d3ee",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1
  },
  refreshSpinning: {
    transform: [{ rotate: "45deg" }]
  },
  sectionCard: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    padding: 16,
    gap: 12
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  sectionHeaderTextContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(6, 182, 212, 0.05)",
    alignItems: "center",
    justifyContent: "center"
  },
  sectionHeaderText: {
    flex: 1
  },
  sectionTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2
  },
  sectionSubtitle: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 1
  },
  sectionHeaderAction: {
    marginLeft: 8
  },
  sectionBody: {
    gap: 8
  },
  sectionCopy: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 16
  },
  actionButton: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    height: 44
  },
  actionButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  buttonIconWrapper: {
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButton: {
    backgroundColor: "#06B6D4"
  },
  secondaryButton: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)"
  },
  primaryButtonText: {
    color: "#081f29",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 1
  },
  secondaryButtonText: {
    color: "#cbd5e1",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 1
  },
  actionButtonText: {
    textAlign: "center"
  },
  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }]
  },
  buttonDisabled: {
    opacity: 0.4
  },
  messageBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(6, 182, 212, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.15)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  shellMessageBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 0
  },
  messageBannerGps: {
    borderColor: "rgba(6, 182, 212, 0.3)"
  },
  messageText: {
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 18,
    flex: 1
  },
  gpsGood: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderColor: "rgba(16, 185, 129, 0.2)"
  },
  gpsBad: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderColor: "rgba(239, 68, 68, 0.2)"
  },
  fieldLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
    marginTop: 6
  },
  input: {
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    color: "#f8fafc",
    fontSize: 14,
    height: 46
  },
  multilineInput: {
    minHeight: 110,
    height: "auto",
    paddingTop: 12,
    paddingBottom: 12
  },
  inputFocused: {
    borderColor: "#06B6D4",
    backgroundColor: "rgba(6, 182, 212, 0.02)"
  },
  inputHint: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 6
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8
  },
  errorText: {
    color: "#f87171",
    fontSize: 12,
    lineHeight: 16,
    flex: 1
  },
  loginActionContainer: {
    marginTop: 12
  },
  loaderState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#060B0E"
  },
  loaderText: {
    color: "#06B6D4",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2
  },
  modalRoot: {
    flex: 1,
    backgroundColor: "#060B0E",
    padding: 16,
    gap: 16
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  modalEyebrow: {
    color: "#06B6D4",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2
  },
  modalTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2,
    marginTop: 2
  },
  cameraFrame: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)"
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
    width: 240,
    height: 240,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(6, 182, 212, 0.5)",
    borderRadius: 120,
    backgroundColor: "rgba(6, 182, 212, 0.03)"
  },
  laserLine: {
    position: "absolute",
    left: "15%",
    right: "15%",
    height: 2,
    backgroundColor: "#22D3EE",
    shadowColor: "#06B6D4",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6
  },
  cornerTL: { position: "absolute", top: 30, left: 30, width: 20, height: 20, borderTopWidth: 2, borderLeftWidth: 2, borderColor: "#06B6D4" },
  cornerTR: { position: "absolute", top: 30, right: 30, width: 20, height: 20, borderTopWidth: 2, borderRightWidth: 2, borderColor: "#06B6D4" },
  cornerBL: { position: "absolute", bottom: 30, left: 30, width: 20, height: 20, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: "#06B6D4" },
  cornerBR: { position: "absolute", bottom: 30, right: 30, width: 20, height: 20, borderBottomWidth: 2, borderRightWidth: 2, borderColor: "#06B6D4" },
  scannerStatusContainer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "rgba(6, 11, 14, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.2)",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center"
  },
  scannerStatusText: {
    color: "#22d3ee",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2
  },
  modalHint: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center"
  },
  emptyHistoryBox: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.01)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 20
  },
  emptyHistory: {
    color: "#475569",
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 24
  },
  historyItem: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    backgroundColor: "rgba(255, 255, 255, 0.015)",
    padding: 14,
    gap: 12
  },
  historyTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  historyStatusWrapper: {
    flexDirection: "row",
    alignItems: "center"
  },
  historyStatus: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1
  },
  historyDate: {
    color: "#64748b",
    fontSize: 11
  },
  historyMetricsGrid: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    paddingTop: 10,
    gap: 8
  },
  historyMetric: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    borderRadius: 8,
    padding: 8,
    gap: 2
  },
  historyMetricLabel: {
    color: "#475569",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.5
  },
  historyMetricVal: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace"
  },
  tabBar: {
    height: 56,
    flexDirection: "row",
    backgroundColor: "rgba(6, 11, 14, 0.95)",
    borderTopWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    paddingBottom: Platform.OS === "ios" ? 12 : 4,
    paddingTop: 4
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1,
    color: "#64748b"
  },
  tabLabelActive: {
    color: "#06B6D4",
    fontWeight: "700"
  },
  historyHeaderSection: {
    marginBottom: 4,
    gap: 4
  },
  historySectionTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.2
  },
  historySectionSubtitle: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 16
  },
  filterChipsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)"
  },
  filterChipActive: {
    backgroundColor: "rgba(6, 182, 212, 0.08)",
    borderColor: "rgba(6, 182, 212, 0.25)"
  },
  filterChipText: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5
  },
  filterChipTextActive: {
    color: "#22d3ee"
  },
  historyListContainer: {
    gap: 10
  },
  leaveFormRow: {
    flexDirection: "row",
    gap: 12
  },
  leaveFieldColumn: {
    flex: 1
  },
  leaveLoadingState: {
    paddingVertical: 12,
    gap: 8,
    alignItems: "flex-start"
  },
  leaveRequestList: {
    gap: 10
  },
  leaveRequestCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    backgroundColor: "rgba(255, 255, 255, 0.015)",
    padding: 14,
    gap: 12
  },
  leaveRequestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  leaveRequestTitleWrap: {
    flex: 1,
    gap: 4
  },
  leaveRequestRange: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2
  },
  leaveRequestTimestamp: {
    color: "#64748b",
    fontSize: 11
  },
  leaveStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "rgba(255, 255, 255, 0.03)"
  },
  leaveStatusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8
  },
  leaveDetailGrid: {
    gap: 8
  },
  leaveDetailCard: {
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    borderRadius: 12,
    padding: 10,
    gap: 4
  },
  leaveDetailLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  leaveDetailValue: {
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 18
  },
  leaveParentNoteBox: {
    backgroundColor: "rgba(6, 182, 212, 0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.12)",
    padding: 10,
    gap: 4
  },
  leaveParentNoteLabel: {
    color: "#22d3ee",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  leaveParentNoteValue: {
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 18
  },
  leaveDecisionStamp: {
    color: "#64748b",
    fontSize: 11
  },
  idCardTabContainer: {
    alignItems: "stretch"
  },
  idCardOuter: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20
  },
  idCardContainer: {
    width: "100%",
    aspectRatio: 1.58,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.2)",
    padding: 16,
    justifyContent: "space-between",
    position: "relative",
    overflow: "hidden"
  },
  idCardContainerBack: {
    width: "100%",
    aspectRatio: 1.58,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.15)",
    padding: 16,
    justifyContent: "space-between",
    position: "relative",
    overflow: "hidden"
  },
  idCardGlow: {
    position: "absolute",
    top: -50,
    right: -50,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(6, 182, 212, 0.12)",
    filter: "blur(20px)"
  },
  idCardGlowBack: {
    position: "absolute",
    top: -50,
    left: -50,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(6, 182, 212, 0.08)",
    filter: "blur(20px)"
  },
  idCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  idCardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  idCardTitle: {
    color: "#cbd5e1",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5
  },
  idCardStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderColor: "rgba(16, 185, 129, 0.2)",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4
  },
  statusDotLive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981"
  },
  idCardStatusText: {
    color: "#34d399",
    fontSize: 8,
    fontWeight: "700"
  },
  idCardBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16
  },
  idCardAvatarContainer: {
    alignItems: "center",
    justifyContent: "center"
  },
  idCardAvatarFrame: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: "rgba(6, 182, 212, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  idCardAvatarHUD: {
    position: "absolute",
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.1)",
    borderStyle: "dashed"
  },
  idCardMeta: {
    flex: 1,
    gap: 2
  },
  idCardLabel: {
    color: "#475569",
    fontSize: 7,
    fontWeight: "700",
    letterSpacing: 0.5
  },
  idCardName: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.2
  },
  idCardUid: {
    color: "#22d3ee",
    fontSize: 8,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    lineHeight: 10
  },
  idCardRow: {
    flexDirection: "row",
    marginTop: 2
  },
  idCardVal: {
    color: "#94a3b8",
    fontSize: 9,
    fontWeight: "600"
  },
  idCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end"
  },
  barcodeContainer: {
    flexDirection: "row",
    alignItems: "center"
  },
  idCardTapPrompt: {
    color: "#475569",
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 0.5
  },
  backCardTitle: {
    color: "#cbd5e1",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1
  },
  backCardMetaItem: {
    gap: 2
  },
  backCardLabel: {
    color: "#475569",
    fontSize: 8,
    fontWeight: "700"
  },
  backCardVal: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "600"
  },
  backCardWarningBox: {
    backgroundColor: "rgba(6, 182, 212, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.1)",
    borderRadius: 8,
    padding: 8
  },
  backCardWarningText: {
    color: "#64748b",
    fontSize: 8,
    lineHeight: 11
  }
});

export default styles;
