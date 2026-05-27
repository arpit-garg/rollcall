import React from "react";
import { Platform, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import styles from "../styles";
import { formatDateTime } from "../utils/helpers";

export default function HistoryItem({ record }) {
  const isPass = record.status === "verified";
  const isFail = record.status === "failed";
  const iconName = isPass ? "shield-checkmark" : isFail ? "shield-alert" : "shield-sync";
  const statusColor = isPass ? "#34d399" : isFail ? "#f87171" : "#fbbf24";

  return (
    <View style={styles.historyItem}>
      <View style={styles.historyTopRow}>
        <View style={styles.historyStatusWrapper}>
          <Ionicons name={iconName} size={16} color={statusColor} style={{ marginRight: 6 }} />
          <Text style={[styles.historyStatus, { color: statusColor }]}>
            {record.status.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.historyDate}>{formatDateTime(record.submittedAt)}</Text>
      </View>
      <View style={styles.historyMetricsGrid}>
        <View style={styles.historyMetric}>
          <Text style={styles.historyMetricLabel}>FACE MATRIX MATCH</Text>
          <Text style={styles.historyMetricVal}>{record.faceScore != null ? `${Math.round(record.faceScore * 100)}%` : "--"}</Text>
        </View>
        <View style={styles.historyMetric}>
          <Text style={styles.historyMetricLabel}>LIVENESS PROOF</Text>
          <Text style={styles.historyMetricVal}>{record.livenessScore != null ? `${Math.round(record.livenessScore * 100)}%` : "--"}</Text>
        </View>
        <View style={styles.historyMetric}>
          <Text style={styles.historyMetricLabel}>GEOFENCE SYNC</Text>
          <Text style={styles.historyMetricVal}>{record.geoVerified ? "PASSED" : "FAILED"}</Text>
        </View>
      </View>
    </View>
  );
}
