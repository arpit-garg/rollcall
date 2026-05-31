const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  buildStudentSignupPayload,
  getStudentSignupValidationMessage,
  buildLeaveRequestPayload,
  getLeaveRequestValidationMessage,
  formatLeaveDateRange
} = require("../src/utils/studentPortal.js");

test("buildStudentSignupPayload trims student fields and excludes parent link fields", () => {
  assert.deepEqual(
    buildStudentSignupPayload({
      name: "Aarav Sharma",
      email: " aarav.sharma@nitj.ac.in ",
      password: "secret123",
      hostelId: "hostel-1",
      roomNumber: " A-102 ",
      parentName: " Meera Sharma ",
      parentEmail: " meera.sharma@family.com ",
      parentPassword: " parent-secret "
    }),
    {
      name: "Aarav Sharma",
      email: "aarav.sharma@nitj.ac.in",
      password: "secret123",
      hostelId: "hostel-1",
      roomNumber: "A-102"
    }
  );
});

test("getStudentSignupValidationMessage requires an NITJ student email", () => {
  assert.equal(
    getStudentSignupValidationMessage({
      name: "Aarav Sharma",
      email: "aarav.sharma@college.edu",
      password: "secret123",
      hostelId: "hostel-1"
    }),
    "Use your NITJ student email address ending in @nitj.ac.in."
  );
});

test("getStudentSignupValidationMessage rejects parent details in student signup", () => {
  assert.equal(
    getStudentSignupValidationMessage({
      name: "Aarav Sharma",
      email: "aarav.sharma@nitj.ac.in",
      password: "secret123",
      hostelId: "hostel-1",
      parentName: "Meera Sharma",
      parentEmail: "meera.sharma@family.com",
      parentPassword: "parent-secret"
    }),
    "Parent signup is separate. Parents should register with the student's registered ID."
  );
});

test("buildLeaveRequestPayload trims text fields and preserves date-only values", () => {
  assert.deepEqual(
    buildLeaveRequestPayload({
      requestedFrom: "2026-06-10",
      requestedTo: "2026-06-12",
      destination: " Chandigarh ",
      reason: " Family function "
    }),
    {
      requestedFrom: "2026-06-10",
      requestedTo: "2026-06-12",
      destination: "Chandigarh",
      reason: "Family function"
    }
  );
});

test("getLeaveRequestValidationMessage rejects leave ranges that end before they start", () => {
  assert.equal(
    getLeaveRequestValidationMessage({
      requestedFrom: "2026-06-12",
      requestedTo: "2026-06-10",
      destination: "Chandigarh",
      reason: "Family function"
    }),
    "Return date must be on or after the departure date."
  );
});

test("formatLeaveDateRange formats single-day and multi-day leave windows", () => {
  assert.equal(
    formatLeaveDateRange({
      requestedFrom: "2026-06-12",
      requestedTo: "2026-06-12"
    }),
    "12 Jun 2026"
  );

  assert.equal(
    formatLeaveDateRange({
      requestedFrom: "2026-06-12",
      requestedTo: "2026-06-15"
    }),
    "12 Jun 2026 - 15 Jun 2026"
  );
});
