function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function trimOptionalString(value) {
  const trimmedValue = trimString(value);
  return trimmedValue || null;
}

function isNitjStudentEmail(value) {
  return /^[^\s@]+@nitj\.ac\.in$/i.test(trimString(value));
}

function isDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(trimString(value));
}

function formatDateOnly(value) {
  if (!isDateOnly(value)) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(`${trimString(value)}T00:00:00.000Z`));
}

export function buildStudentSignupPayload({
  name,
  email,
  password,
  hostelId,
  roomNumber
} = {}) {
  const payload = {
    name: trimString(name),
    email: trimString(email),
    password: trimString(password),
    hostelId: trimString(hostelId)
  };
  const normalizedRoomNumber = trimOptionalString(roomNumber);

  if (normalizedRoomNumber) {
    payload.roomNumber = normalizedRoomNumber;
  }

  return payload;
}

export function getStudentSignupValidationMessage({
  name,
  email,
  password,
  hostelId,
  parentName,
  parentEmail,
  parentPassword
} = {}) {
  if (!trimString(name) || !trimString(email) || !trimString(password) || !trimString(hostelId)) {
    return "Name, email, password, and hostel are required.";
  }

  if (!isNitjStudentEmail(email)) {
    return "Use your NITJ student email address ending in @nitj.ac.in.";
  }

  const parentValues = [
    trimOptionalString(parentName),
    trimOptionalString(parentEmail),
    trimOptionalString(parentPassword)
  ];
  const hasAnyParentField = parentValues.some(Boolean);

  if (hasAnyParentField) {
    return "Parent signup is separate. Parents should register with the student's registered ID.";
  }

  return null;
}

export function buildLeaveRequestPayload({
  requestedFrom,
  requestedTo,
  destination,
  reason
} = {}) {
  return {
    requestedFrom: trimString(requestedFrom),
    requestedTo: trimString(requestedTo),
    destination: trimString(destination),
    reason: trimString(reason)
  };
}

export function getLeaveRequestValidationMessage({
  requestedFrom,
  requestedTo,
  destination,
  reason
} = {}) {
  const payload = buildLeaveRequestPayload({
    requestedFrom,
    requestedTo,
    destination,
    reason
  });

  if (!payload.requestedFrom || !payload.requestedTo || !payload.destination || !payload.reason) {
    return "Departure date, return date, destination, and reason are required.";
  }

  if (!isDateOnly(payload.requestedFrom) || !isDateOnly(payload.requestedTo)) {
    return "Use YYYY-MM-DD for both leave dates.";
  }

  if (payload.requestedTo < payload.requestedFrom) {
    return "Return date must be on or after the departure date.";
  }

  return null;
}

export function formatLeaveDateRange({
  requestedFrom,
  requestedTo
} = {}) {
  const formattedStart = formatDateOnly(requestedFrom);
  const formattedEnd = formatDateOnly(requestedTo || requestedFrom);

  if (formattedStart === "--" && formattedEnd === "--") {
    return "--";
  }

  if (formattedStart === formattedEnd) {
    return formattedStart;
  }

  return `${formattedStart} - ${formattedEnd}`;
}

export function getLeaveStatusMeta(status) {
  if (status === "approved") {
    return {
      color: "#34d399",
      iconName: "checkmark-circle",
      label: "APPROVED"
    };
  }

  if (status === "rejected") {
    return {
      color: "#f87171",
      iconName: "close-circle",
      label: "REJECTED"
    };
  }

  return {
    color: "#fbbf24",
    iconName: "time",
    label: "PENDING"
  };
}
