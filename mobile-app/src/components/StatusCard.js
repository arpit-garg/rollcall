import { StyleSheet, Text, View } from "react-native";

const toneStyles = {
  dark: { 
    backgroundColor: "rgba(255, 255, 255, 0.03)", 
    textColor: "#f8fafc", 
    labelColor: "#94a3b8",
    borderColor: "rgba(255, 255, 255, 0.08)" 
  },
  success: { 
    backgroundColor: "rgba(16, 185, 129, 0.08)", 
    textColor: "#34d399", 
    labelColor: "#6ee7b7",
    borderColor: "rgba(16, 185, 129, 0.2)" 
  },
  accent: { 
    backgroundColor: "rgba(6, 182, 212, 0.08)", 
    textColor: "#22d3ee", 
    labelColor: "#67e8f9",
    borderColor: "rgba(6, 182, 212, 0.2)" 
  },
  danger: { 
    backgroundColor: "rgba(239, 68, 68, 0.08)", 
    textColor: "#f87171", 
    labelColor: "#fca5a5",
    borderColor: "rgba(239, 68, 68, 0.2)" 
  },
  light: { 
    backgroundColor: "rgba(255, 255, 255, 0.015)", 
    textColor: "#cbd5e1", 
    labelColor: "#64748b",
    borderColor: "rgba(255, 255, 255, 0.04)" 
  }
};

export default function StatusCard({ label, value, tone }) {
  const palette = toneStyles[tone] ?? toneStyles.light;

  return (
    <View style={[
      styles.card, 
      { 
        backgroundColor: palette.backgroundColor,
        borderColor: palette.borderColor
      }
    ]}>
      <Text style={[styles.label, { color: palette.labelColor }]}>{label}</Text>
      <Text style={[styles.value, { color: palette.textColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    gap: 4
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontFamily: "System"
  },
  value: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
    fontFamily: "System"
  }
});

