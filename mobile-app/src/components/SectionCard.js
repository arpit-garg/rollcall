import React from "react";
import { View, Text } from "react-native";
import styles from "../styles";

export default function SectionCard({ title, subtitle, children, rightAction, icon }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderTextContainer}>
          {icon ? <View style={styles.sectionIcon}>{icon}</View> : null}
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
          </View>
        </View>
        {rightAction ? <View style={styles.sectionHeaderAction}>{rightAction}</View> : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}
