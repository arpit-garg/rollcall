import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Easing, Modal, SafeAreaView, Text, View } from "react-native";
import { CameraView } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import styles from "../styles";
import ActionButton from "../components/ActionButton";

export default function CaptureModal({ visible, mode, cameraRef, onClose, onCapture, isBusy }) {
  const scanAnim = useRef(new Animated.Value(0)).current;
  const title = mode === "enrollment" ? "Register Biometric Face" : "Verify Attendance Face";

  useEffect(() => {
    if (visible) {
      scanAnim.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 2200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 2200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          })
        ])
      ).start();
    } else {
      scanAnim.stopAnimation();
    }
  }, [visible]);

  // Translate scanning bar across the camera viewport
  const translateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 290]
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.modalRoot}>
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalEyebrow}>SECURE HUDBIOMETRIC</Text>
            <Text style={styles.modalTitle}>{title}</Text>
          </View>
          <ActionButton 
            label="ABORT" 
            onPress={onClose} 
            tone="secondary" 
            icon={<Ionicons name="close-circle-outline" size={16} color="#cbd5e1" />}
          />
        </View>

        <View style={styles.cameraFrame}>
          <CameraView ref={cameraRef} style={styles.camera} facing="front" />
          <View style={styles.cameraOverlay} pointerEvents="none">
            {/* Holographic scanner layout */}
            <View style={styles.cameraGuide} />
            <Animated.View style={[styles.laserLine, { transform: [{ translateY }] }]} />
            <View style={styles.cornerTL} />
            <View style={styles.cornerTR} />
            <View style={styles.cornerBL} />
            <View style={styles.cornerBR} />
          </View>
          <View style={styles.scannerStatusContainer}>
            <Text style={styles.scannerStatusText}>
              {isBusy ? "UPLOADING BIOMETRICS..." : "ALIGN FACE INSIDE HUDBOX"}
            </Text>
          </View>
        </View>

        <Text style={styles.modalHint}>
          Hold device steady in proper lighting. Biometric embeddings are synthesized directly into secure local hashes.
        </Text>

        <ActionButton
          label={isBusy ? "VERIFYING MATRIX..." : "CAPTURE EMBEDDING"}
          onPress={onCapture}
          disabled={isBusy}
          icon={isBusy ? <ActivityIndicator size="small" color="#081f29" /> : <Ionicons name="scan-outline" size={18} color="#081f29" />}
        />
      </SafeAreaView>
    </Modal>
  );
}
