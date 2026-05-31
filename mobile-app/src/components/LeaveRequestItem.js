import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import styles from "../styles";
import { formatDateTime } from "../utils/helpers";
import { formatLeaveDateRange, getLeaveStatusMeta } from "../utils/studentPortal";

export default function LeaveRequestItem({ request }) {
  const statusMeta = getLeaveStatusMeta(request.status);

  return (
    <View style={styles.leaveRequestCard}>
      <View style={styles.leaveRequestHeader}>
        <View style={styles.leaveRequestTitleWrap}>
          <Text style={styles.leaveRequestRange}>{formatLeaveDateRange(request)}</Text>
          <Text style={styles.leaveRequestTimestamp}>Requested {formatDateTime(request.createdAt)}</Text>
        </View>
        <View style={[styles.leaveStatusBadge, { borderColor: statusMeta.color }]}>
          <Ionicons name={statusMeta.iconName} size={14} color={statusMeta.color} style={{ marginRight: 4 }} />
          <Text style={[styles.leaveStatusBadgeText, { color: statusMeta.color }]}>
            {statusMeta.label}
          </Text>
        </View>
      </View>

      <View style={styles.leaveDetailGrid}>
        <View style={styles.leaveDetailCard}>
          <Text style={styles.leaveDetailLabel}>Destination</Text>
          <Text style={styles.leaveDetailValue}>{request.destination || "--"}</Text>
        </View>
        <View style={styles.leaveDetailCard}>
          <Text style={styles.leaveDetailLabel}>Reason</Text>
          <Text style={styles.leaveDetailValue}>{request.reason || "--"}</Text>
        </View>
      </View>

      {request.parentNote ? (
        <View style={styles.leaveParentNoteBox}>
          <Text style={styles.leaveParentNoteLabel}>Parent Note</Text>
          <Text style={styles.leaveParentNoteValue}>{request.parentNote}</Text>
        </View>
      ) : null}

      {request.decidedAt ? (
        <Text style={styles.leaveDecisionStamp}>
          Decision recorded {formatDateTime(request.decidedAt)}
        </Text>
      ) : (
        <Text style={styles.leaveDecisionStamp}>
          Waiting for parent review.
        </Text>
      )}
    </View>
  );
}
