import { StyleSheet, Text, View } from "react-native";

const toneStyles = {
  dark: { backgroundColor: "#12384b", textColor: "#f7fbfc", labelColor: "#8ed1c4" },
  success: { backgroundColor: "#1f7a5c", textColor: "#f7fbfc", labelColor: "#d7f9ef" },
  accent: { backgroundColor: "#ef8354", textColor: "#081f29", labelColor: "#4f2b1d" },
  light: { backgroundColor: "#f7fbfc", textColor: "#0f2d3c", labelColor: "#5c677d" }
};

export default function StatusCard({ label, value, tone }) {
  const palette = toneStyles[tone] ?? toneStyles.light;

  return (
    <View style={[styles.card, { backgroundColor: palette.backgroundColor }]}>
      <Text style={[styles.label, { color: palette.labelColor }]}>{label}</Text>
      <Text style={[styles.value, { color: palette.textColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 18,
    gap: 6
  },
  label: {
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase"
  },
  value: {
    fontSize: 18,
    fontWeight: "700"
  }
});
