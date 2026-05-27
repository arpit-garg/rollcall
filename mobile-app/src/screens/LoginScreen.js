import React, { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, ScrollView, Text, TextInput, View, Pressable } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import styles from "../styles";
import ActionButton from "../components/ActionButton";
import SectionCard from "../components/SectionCard";
import { normalizeErrorMessage } from "../utils/helpers";
import { useAuth } from "../state/AuthContext";

export default function LoginScreen() {
  const { login, signup, getHostels } = useAuth();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [focusedField, setFocusedField] = useState("");

  // Common fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Signup-only fields
  const [name, setName] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [hostels, setHostels] = useState([]);
  const [selectedHostelId, setSelectedHostelId] = useState("");

  useEffect(() => {
    if (isSignUp) {
      setErrorMessage("");
      void getHostels()
        .then((data) => {
          setHostels(data);
          if (data.length > 0) {
            setSelectedHostelId(data[0].id);
          }
        })
        .catch((err) => {
          setErrorMessage("Failed to load hostels: " + normalizeErrorMessage(err));
        });
    } else {
      setErrorMessage("");
    }
  }, [isSignUp]);

  async function handleLogin() {
    if (!email || !password) {
      setErrorMessage("Email and password are required.");
      return;
    }
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      await login({ email, password });
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignUp() {
    if (!name || !email || !password || !selectedHostelId) {
      setErrorMessage("Name, email, password, and hostel are required.");
      return;
    }
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      await signup({
        name,
        email,
        password,
        hostelId: selectedHostelId,
        roomNumber
      });
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.loginContainer}>
        <View style={styles.loginHero}>
          <View style={styles.loginLogoContainer}>
            <View style={styles.loginLogoPulse}>
              <MaterialCommunityIcons name="shield-key-outline" size={32} color="#06B6D4" />
            </View>
          </View>
          <Text style={styles.loginEyebrow}>SECURE RESIDENT ACCESS</Text>
          <Text style={styles.loginHeading}>Hostel Verification Portal</Text>
          <Text style={styles.loginCopy}>
            {isSignUp
              ? "Create a new student profile to synchronize biometric models with your hostel parameters."
              : "Authenticate below to synchronize with your college server, register biometric credentials, and log secure attendance."}
          </Text>
        </View>

        {!isSignUp ? (
          <SectionCard
            title="Student Login"
            subtitle="Input email and password to log in."
          >
            <Text style={styles.fieldLabel}>Email Address</Text>
            <TextInput
              style={[
                styles.input,
                focusedField === "email" ? styles.inputFocused : null
              ]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField("")}
              placeholder="student@college.edu"
              placeholderTextColor="#475569"
            />

            <Text style={styles.fieldLabel}>Security Password</Text>
            <TextInput
              style={[
                styles.input,
                focusedField === "password" ? styles.inputFocused : null
              ]}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField("")}
              placeholder="••••••••••••"
              placeholderTextColor="#475569"
            />

            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={18} color="#f87171" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <View style={styles.loginActionContainer}>
              <ActionButton
                label={isSubmitting ? "AUTHENTICATING..." : "SIGN IN"}
                onPress={handleLogin}
                disabled={isSubmitting}
                icon={isSubmitting ? <ActivityIndicator size="small" color="#081f29" /> : <Ionicons name="finger-print-outline" size={18} color="#081f29" />}
              />
              
              <Pressable
                onPress={() => setIsSignUp(true)}
                style={{ marginTop: 16, alignItems: "center" }}
              >
                <Text style={{ color: "#06B6D4", fontSize: 13, fontWeight: "600" }}>
                  Don't have an account? Sign Up
                </Text>
              </Pressable>
            </View>
          </SectionCard>
        ) : (
          <SectionCard
            title="Student Registration"
            subtitle="Fill out the profile details to self-register."
          >
            <Text style={styles.fieldLabel}>Full Name</Text>
            <TextInput
              style={[
                styles.input,
                focusedField === "name" ? styles.inputFocused : null
              ]}
              autoCapitalize="words"
              autoCorrect={false}
              value={name}
              onChangeText={setName}
              onFocus={() => setFocusedField("name")}
              onBlur={() => setFocusedField("")}
              placeholder="Aarav Sharma"
              placeholderTextColor="#475569"
            />

            <Text style={styles.fieldLabel}>Email Address</Text>
            <TextInput
              style={[
                styles.input,
                focusedField === "email" ? styles.inputFocused : null
              ]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField("")}
              placeholder="aarav.sharma@college.edu"
              placeholderTextColor="#475569"
            />

            <Text style={styles.fieldLabel}>Security Password</Text>
            <TextInput
              style={[
                styles.input,
                focusedField === "password" ? styles.inputFocused : null
              ]}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField("")}
              placeholder="••••••••••••"
              placeholderTextColor="#475569"
            />

            <Text style={styles.fieldLabel}>Select Hostel Block</Text>
            {hostels.length === 0 ? (
              <ActivityIndicator size="small" color="#06B6D4" style={{ marginVertical: 8 }} />
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 4 }}>
                {hostels.map((hostel) => {
                  const isSelected = hostel.id === selectedHostelId;
                  return (
                    <Pressable
                      key={hostel.id}
                      onPress={() => setSelectedHostelId(hostel.id)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: isSelected ? "rgba(6, 182, 212, 0.08)" : "rgba(255, 255, 255, 0.02)",
                        borderWidth: 1,
                        borderColor: isSelected ? "#06B6D4" : "rgba(255, 255, 255, 0.08)"
                      }}
                    >
                      <Text style={{ color: isSelected ? "#22d3ee" : "#94a3b8", fontSize: 12, fontWeight: "600" }}>
                        {hostel.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <Text style={styles.fieldLabel}>Room Number</Text>
            <TextInput
              style={[
                styles.input,
                focusedField === "room" ? styles.inputFocused : null
              ]}
              autoCapitalize="characters"
              autoCorrect={false}
              value={roomNumber}
              onChangeText={setRoomNumber}
              onFocus={() => setFocusedField("room")}
              onBlur={() => setFocusedField("")}
              placeholder="A-102"
              placeholderTextColor="#475569"
            />

            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={18} color="#f87171" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <View style={styles.loginActionContainer}>
              <ActionButton
                label={isSubmitting ? "CREATING PROFILE..." : "REGISTER PROFILE"}
                onPress={handleSignUp}
                disabled={isSubmitting}
                icon={isSubmitting ? <ActivityIndicator size="small" color="#081f29" /> : <Ionicons name="person-add-outline" size={18} color="#081f29" />}
              />
              
              <Pressable
                onPress={() => setIsSignUp(false)}
                style={{ marginTop: 16, alignItems: "center" }}
              >
                <Text style={{ color: "#06B6D4", fontSize: 13, fontWeight: "600" }}>
                  Already have an account? Sign In
                </Text>
              </Pressable>
            </View>
          </SectionCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
