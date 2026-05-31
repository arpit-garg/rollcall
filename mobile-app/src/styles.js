import { StyleSheet, Platform } from "react-native";
import { getSurfaceShadowStyle, palette } from "./utils/uiTheme";

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background
  },
  screenBackdrop: {
    flex: 1,
    backgroundColor: palette.background
  },
  appShellRoot: {
    flex: 1,
    justifyContent: "space-between"
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 22,
    gap: 16
  },
  loginContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 28,
    gap: 18
  },
  loginHero: {
    backgroundColor: "rgba(16, 27, 34, 0.82)",
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 28,
    padding: 22,
    gap: 14,
    overflow: "hidden",
    ...getSurfaceShadowStyle("raised", Platform.OS)
  },
  loginBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  loginBrandText: {
    flex: 1
  },
  loginLogoContainer: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.28)",
    alignItems: "center",
    justifyContent: "center"
  },
  loginLogoPulse: {
    alignItems: "center",
    justifyContent: "center"
  },
  loginEyebrow: {
    color: palette.accent,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase"
  },
  loginHeading: {
    color: palette.text,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0
  },
  loginCopy: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  loginSignalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  loginSignalPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.18)",
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  loginSignalText: {
    color: "#bae6fd",
    fontSize: 11,
    fontWeight: "700"
  },
  modeSwitch: {
    flexDirection: "row",
    borderRadius: 16,
    backgroundColor: "rgba(3, 7, 18, 0.32)",
    borderWidth: 1,
    borderColor: palette.border,
    padding: 4
  },
  modeSwitchButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  modeSwitchButtonActive: {
    backgroundColor: "rgba(56, 189, 248, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.28)"
  },
  modeSwitchText: {
    color: palette.textSubtle,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  modeSwitchTextActive: {
    color: "#e0f2fe"
  },
  hero: {
    backgroundColor: "rgba(16, 27, 34, 0.88)",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 20,
    gap: 14,
    ...getSurfaceShadowStyle("raised", Platform.OS)
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  eyebrow: {
    color: palette.accent,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase"
  },
  heading: {
    color: palette.text,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0,
    marginTop: 2
  },
  copy: {
    color: palette.textMuted,
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
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.24)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6
  },
  refreshBadgeText: {
    color: "#bae6fd",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6
  },
  refreshSpinning: {
    transform: [{ rotate: "45deg" }]
  },
  sectionCard: {
    backgroundColor: "rgba(16, 27, 34, 0.86)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    gap: 14,
    ...getSurfaceShadowStyle("soft", Platform.OS)
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
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.18)",
    alignItems: "center",
    justifyContent: "center"
  },
  sectionHeaderText: {
    flex: 1
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0
  },
  sectionSubtitle: {
    color: palette.textMuted,
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
  spacerSmall: {
    height: 8
  },
  sectionCopy: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 16
  },
  actionButton: {
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    ...getSurfaceShadowStyle("soft", Platform.OS)
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
    backgroundColor: palette.accent
  },
  secondaryButton: {
    backgroundColor: "rgba(226, 232, 240, 0.06)",
    borderWidth: 1,
    borderColor: palette.border
  },
  primaryButtonText: {
    color: palette.ink,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.8
  },
  secondaryButtonText: {
    color: "#e2e8f0",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.8
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
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...getSurfaceShadowStyle("soft", Platform.OS)
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
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 6,
    marginTop: 6
  },
  input: {
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 11,
    backgroundColor: "rgba(3, 7, 18, 0.32)",
    color: palette.text,
    fontSize: 14,
    minHeight: 48
  },
  multilineInput: {
    minHeight: 110,
    height: "auto",
    paddingTop: 12,
    paddingBottom: 12
  },
  inputFocused: {
    borderColor: "rgba(56, 189, 248, 0.62)",
    backgroundColor: "rgba(56, 189, 248, 0.06)"
  },
  inputHint: {
    color: palette.textSubtle,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 6
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(251, 113, 133, 0.1)",
    borderColor: "rgba(251, 113, 133, 0.24)",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8
  },
  errorText: {
    color: "#fecdd3",
    fontSize: 12,
    lineHeight: 16,
    flex: 1
  },
  loginActionContainer: {
    gap: 12,
    marginTop: 12
  },
  linkButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    borderRadius: 12
  },
  linkButtonText: {
    color: "#7dd3fc",
    fontSize: 13,
    fontWeight: "800"
  },
  hostelChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 4
  },
  hostelChip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(226, 232, 240, 0.05)",
    borderWidth: 1,
    borderColor: palette.border
  },
  hostelChipActive: {
    backgroundColor: "rgba(56, 189, 248, 0.13)",
    borderColor: "rgba(56, 189, 248, 0.46)"
  },
  hostelChipPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }]
  },
  hostelChipText: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  hostelChipTextActive: {
    color: "#e0f2fe"
  },
  loaderState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: palette.background
  },
  loaderText: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2
  },
  modalRoot: {
    flex: 1,
    backgroundColor: palette.background,
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
    color: palette.accent,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.4
  },
  modalTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0,
    marginTop: 2
  },
  cameraFrame: {
    flex: 1,
    borderRadius: 26,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: palette.borderStrong,
    ...getSurfaceShadowStyle("raised", Platform.OS)
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
    borderColor: "rgba(56, 189, 248, 0.62)",
    borderRadius: 120,
    backgroundColor: "rgba(56, 189, 248, 0.04)"
  },
  laserLine: {
    position: "absolute",
    left: "15%",
    right: "15%",
    height: 2,
    backgroundColor: palette.accent,
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6
  },
  cornerTL: { position: "absolute", top: 30, left: 30, width: 20, height: 20, borderTopWidth: 2, borderLeftWidth: 2, borderColor: palette.accent },
  cornerTR: { position: "absolute", top: 30, right: 30, width: 20, height: 20, borderTopWidth: 2, borderRightWidth: 2, borderColor: palette.accent },
  cornerBL: { position: "absolute", bottom: 30, left: 30, width: 20, height: 20, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: palette.accent },
  cornerBR: { position: "absolute", bottom: 30, right: 30, width: 20, height: 20, borderBottomWidth: 2, borderRightWidth: 2, borderColor: palette.accent },
  scannerStatusContainer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "rgba(7, 16, 20, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.24)",
    borderRadius: 14,
    paddingVertical: 8,
    alignItems: "center"
  },
  scannerStatusText: {
    color: "#bae6fd",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2
  },
  modalHint: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center"
  },
  emptyHistoryBox: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(226, 232, 240, 0.04)",
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 22
  },
  emptyHistory: {
    color: palette.textSubtle,
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 24
  },
  historyItem: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(16, 27, 34, 0.78)",
    padding: 14,
    gap: 12,
    ...getSurfaceShadowStyle("soft", Platform.OS)
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
    color: palette.textMuted,
    fontSize: 11
  },
  historyMetricsGrid: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: palette.border,
    paddingTop: 10,
    gap: 8
  },
  historyMetric: {
    flex: 1,
    backgroundColor: "rgba(3, 7, 18, 0.26)",
    borderRadius: 12,
    padding: 8,
    gap: 2
  },
  historyMetricLabel: {
    color: palette.textSubtle,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.5
  },
  historyMetricVal: {
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace"
  },
  tabBar: {
    height: 66,
    flexDirection: "row",
    backgroundColor: "rgba(7, 16, 20, 0.98)",
    borderTopWidth: 1,
    borderColor: palette.border,
    paddingBottom: Platform.OS === "ios" ? 14 : 6,
    paddingTop: 6
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: palette.textSubtle
  },
  tabLabelActive: {
    color: "#7dd3fc",
    fontWeight: "800"
  },
  historyHeaderSection: {
    marginBottom: 4,
    gap: 4
  },
  historySectionTitle: {
    color: palette.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0
  },
  historySectionSubtitle: {
    color: palette.textMuted,
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
    borderRadius: 999,
    backgroundColor: "rgba(226, 232, 240, 0.05)",
    borderWidth: 1,
    borderColor: palette.border
  },
  filterChipActive: {
    backgroundColor: "rgba(56, 189, 248, 0.13)",
    borderColor: "rgba(56, 189, 248, 0.42)"
  },
  filterChipText: {
    color: palette.textSubtle,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5
  },
  filterChipTextActive: {
    color: "#e0f2fe"
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(16, 27, 34, 0.78)",
    padding: 14,
    gap: 12,
    ...getSurfaceShadowStyle("soft", Platform.OS)
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
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0
  },
  leaveRequestTimestamp: {
    color: palette.textMuted,
    fontSize: 11
  },
  leaveStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "rgba(226, 232, 240, 0.06)"
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
    backgroundColor: "rgba(3, 7, 18, 0.28)",
    borderRadius: 12,
    padding: 10,
    gap: 4
  },
  leaveDetailLabel: {
    color: palette.textSubtle,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  leaveDetailValue: {
    color: "#e2e8f0",
    fontSize: 13,
    lineHeight: 18
  },
  leaveParentNoteBox: {
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.18)",
    padding: 10,
    gap: 4
  },
  leaveParentNoteLabel: {
    color: "#7dd3fc",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  leaveParentNoteValue: {
    color: "#e2e8f0",
    fontSize: 13,
    lineHeight: 18
  },
  leaveDecisionStamp: {
    color: palette.textMuted,
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
    borderRadius: 26,
    backgroundColor: "rgba(16, 27, 34, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.28)",
    padding: 16,
    justifyContent: "space-between",
    position: "relative",
    overflow: "hidden",
    ...getSurfaceShadowStyle("raised", Platform.OS)
  },
  idCardContainerBack: {
    width: "100%",
    aspectRatio: 1.58,
    borderRadius: 26,
    backgroundColor: "rgba(16, 27, 34, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.22)",
    padding: 16,
    justifyContent: "space-between",
    position: "relative",
    overflow: "hidden",
    ...getSurfaceShadowStyle("raised", Platform.OS)
  },
  idCardGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "rgba(56, 189, 248, 0.72)"
  },
  idCardGlowBack: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "rgba(52, 211, 153, 0.64)"
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
    color: "#e2e8f0",
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
    borderRadius: 999,
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
    color: palette.text,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0
  },
  idCardUid: {
    color: "#7dd3fc",
    fontSize: 8,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    lineHeight: 10
  },
  idCardRow: {
    flexDirection: "row",
    marginTop: 2
  },
  idCardInfoColumn: {
    flex: 1
  },
  idCardVal: {
    color: palette.textMuted,
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
    color: palette.textSubtle,
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 0.5
  },
  backCardTitle: {
    color: "#e2e8f0",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1
  },
  backCardMetaItem: {
    gap: 2
  },
  backCardLabel: {
    color: palette.textSubtle,
    fontSize: 8,
    fontWeight: "700"
  },
  backCardVal: {
    color: palette.textMuted,
    fontSize: 10,
    fontWeight: "600"
  },
  backCardWarningBox: {
    backgroundColor: "rgba(56, 189, 248, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.14)",
    borderRadius: 12,
    padding: 8
  },
  backCardWarningText: {
    color: palette.textMuted,
    fontSize: 8,
    lineHeight: 11
  }
});

export default styles;
