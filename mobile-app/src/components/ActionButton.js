import React from "react";
import { Pressable, Text, View } from "react-native";
import styles from "../styles";

export default function ActionButton({ label, onPress, disabled = false, tone = "primary", icon }) {
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
      <View style={styles.actionButtonContent}>
        {icon ? <View style={styles.buttonIconWrapper}>{icon}</View> : null}
        <Text
          style={[
            styles.actionButtonText,
            tone === "secondary" ? styles.secondaryButtonText : styles.primaryButtonText
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
