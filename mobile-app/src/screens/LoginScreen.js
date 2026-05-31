import React, { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, ScrollView, Text, TextInput, View, Pressable } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import styles from "../styles";
import ActionButton from "../components/ActionButton";
import SectionCard from "../components/SectionCard";
import { normalizeErrorMessage } from "../utils/helpers";
import { useAuth } from "../state/AuthContext";
import { getStudentSignupValidationMessage } from "../utils/studentPortal";

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
    const validationMessage = getStudentSignupValidationMessage({
      name,
      email,
      password,
      hostelId: selectedHostelId
    });

    if (validationMessage) {
      setErrorMessage(validationMessage);
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
      <ScrollView contentContainerStyle={styles.loginContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.loginHero}>
          <View style={styles.loginBrandRow}>
            <View style={styles.loginLogoContainer}>
              <View style={styles.loginLogoPulse}>
                <MaterialCommunityIcons name="shield-key-outline" size={28} color="#38BDF8" />
              </View>
            </View>
            <View style={styles.loginBrandText}>
              <Text style={styles.loginEyebrow}>NITJ RESIDENT ACCESS</Text>
              <Text style={styles.loginHeading}>Hostel Attendance</Text>
            </View>
          </View>
          <Text style={styles.loginCopy}>
            {isSignUp
              ? "Create your student profile with your NITJ email."
              : "Sign in to mark attendance and manage your resident pass."}
          </Text>
          <View style={styles.loginSignalRow}>
            <View style={styles.loginSignalPill}>
              <Ionicons name="shield-checkmark-outline" size={14} color="#7dd3fc" />
              <Text style={styles.loginSignalText}>Secure</Text>
            </View>
            <View style={styles.loginSignalPill}>
              <Ionicons name="location-outline" size={14} color="#7dd3fc" />
              <Text style={styles.loginSignalText}>Location Aware</Text>
            </View>
            <View style={styles.loginSignalPill}>
              <Ionicons name="sparkles-outline" size={14} color="#7dd3fc" />
              <Text style={styles.loginSignalText}>Modern</Text>
            </View>
          </View>
        </View>

        <View style={styles.modeSwitch}>
          <Pressable
            onPress={() => {
              setIsSignUp(false);
              setErrorMessage("");
            }}
            style={[styles.modeSwitchButton, !isSignUp ? styles.modeSwitchButtonActive : null]}
          >
            <Text style={[styles.modeSwitchText, !isSignUp ? styles.modeSwitchTextActive : null]}>
              Sign In
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setIsSignUp(true);
              setErrorMessage("");
            }}
            style={[styles.modeSwitchButton, isSignUp ? styles.modeSwitchButtonActive : null]}
          >
            <Text style={[styles.modeSwitchText, isSignUp ? styles.modeSwitchTextActive : null]}>
              Sign Up
            </Text>
          </Pressable>
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
              placeholder="student@nitj.ac.in"
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
              placeholder="Password"
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
                style={styles.linkButton}
              >
                <Text style={styles.linkButtonText}>
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
              placeholder="aarav.sharma@nitj.ac.in"
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
              placeholder="Password"
              placeholderTextColor="#475569"
            />

            <Text style={styles.fieldLabel}>Select Hostel Block</Text>
            {hostels.length === 0 ? (
              <ActivityIndicator size="small" color="#06B6D4" style={{ marginVertical: 8 }} />
            ) : (
              <View style={styles.hostelChipRow}>
                {hostels.map((hostel) => {
                  const isSelected = hostel.id === selectedHostelId;
                  return (
                    <Pressable
                      key={hostel.id}
                      onPress={() => setSelectedHostelId(hostel.id)}
                      style={({ pressed }) => [
                        styles.hostelChip,
                        isSelected ? styles.hostelChipActive : null,
                        pressed ? styles.hostelChipPressed : null
                      ]}
                    >
                      <Text style={[styles.hostelChipText, isSelected ? styles.hostelChipTextActive : null]}>
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
            <Text style={styles.inputHint}>
              Optional if your room allocation is pending.
            </Text>

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
                style={styles.linkButton}
              >
                <Text style={styles.linkButtonText}>
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
