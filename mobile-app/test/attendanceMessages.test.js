const assert = require("node:assert/strict");

const { getVerificationResultMessage } = require("../src/utils/attendanceMessages");

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

test("includes face and liveness scores when verification fails after scoring", () => {
  assert.equal(
    getVerificationResultMessage({
      status: "failed",
      faceScore: 0.62,
      livenessScore: 0.91
    }),
    "Attendance verification failed. Face match 62%, liveness 91%."
  );
});

test("explains failure before scoring when ML could not produce scores", () => {
  assert.equal(
    getVerificationResultMessage({
      status: "failed",
      faceScore: null,
      livenessScore: null
    }),
    "Attendance verification failed before scoring. Re-enroll your face and try again."
  );
});

test("includes scores in success message when available", () => {
  assert.equal(
    getVerificationResultMessage({
      status: "verified",
      faceScore: 0.98,
      livenessScore: 0.99
    }),
    "Attendance verified successfully. Face match 98%, liveness 99%."
  );
});

test("uses clear processing copy while verification is pending", () => {
  assert.equal(
    getVerificationResultMessage({
      status: "pending"
    }),
    "Attendance verification is processing. We will update this screen when it finishes."
  );
});
