import { Platform, StyleSheet, Text, View } from "react-native";
import { getSurfaceShadowStyle, getTonePalette } from "../utils/uiTheme";

function normalizeTone(tone) {
  if (tone === "light" || tone === "dark") {
    return "neutral";
  }

  return tone;
}

export default function StatusCard({ label, value, tone }) {
  const tonePalette = getTonePalette(normalizeTone(tone));

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tonePalette.background,
          borderColor: tonePalette.border
        },
        getSurfaceShadowStyle("soft", Platform.OS)
      ]}
    >
      <View style={[styles.accentRail, { backgroundColor: tonePalette.accent }]} />
      <Text style={[styles.label, { color: tonePalette.label }]}>{label}</Text>
      <Text style={[styles.value, { color: tonePalette.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    gap: 5
  },
  accentRail: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontFamily: "System"
  },
  value: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0,
    fontFamily: "System"
  }
});
