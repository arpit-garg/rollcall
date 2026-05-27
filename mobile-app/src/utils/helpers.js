// Utility: Generate unique keys for idempotent requests
export function createIdempotencyKey() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const randomValue = Math.floor(Math.random() * 16);
    const value = character === "x" ? randomValue : (randomValue & 0x3) | 0x8;
    return value.toString(16);
  });
}

// Utility: Meticulous Indian locale datetime formatter
export function formatDateTime(value) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

// Utility: Normalize server/network error codes
export function normalizeErrorMessage(error) {
  return error?.body?.error?.message || error?.message || "Something went wrong.";
}

export function getEnrollmentTone(status) {
  if (status === "enrolled") return "success";
  if (status === "processing") return "accent";
  return "light";
}

export function getAttendanceTone(status) {
  if (status === "verified") return "success";
  if (status === "pending") return "accent";
  if (status === "failed") return "danger";
  return "light";
}
