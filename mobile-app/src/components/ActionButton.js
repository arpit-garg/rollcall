import React from "react";
import { Pressable, Text, View } from "react-native";
import styles from "../styles";
import { getPressedScaleStyle } from "../utils/uiTheme";

export default function ActionButton({ label, onPress, disabled = false, tone = "primary", icon }) {
  const isSecondary = tone === "secondary";

  return (
    <Pressable
      accessibilityRole="button"
      android_ripple={{ color: isSecondary ? "rgba(226, 232, 240, 0.08)" : "rgba(8, 31, 41, 0.18)" }}
      hitSlop={8}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionButton,
        isSecondary ? styles.secondaryButton : styles.primaryButton,
        getPressedScaleStyle(pressed, { disabled }),
        disabled ? styles.buttonDisabled : null
      ]}
    >
      <View style={styles.actionButtonContent}>
        {icon ? <View style={styles.buttonIconWrapper}>{icon}</View> : null}
        <Text
          style={[
            styles.actionButtonText,
            isSecondary ? styles.secondaryButtonText : styles.primaryButtonText
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
