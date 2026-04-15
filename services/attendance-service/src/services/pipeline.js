import { env } from "../config/env.js";
import { attendanceStore } from "./attendanceStore.js";
import { requestAttendanceVerification, requestEnrollmentProcessing } from "./mlClient.js";

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function runEnrollmentPipeline({ studentId, imageMeta }) {
  try {
    if (env.enableDemoResolution) {
      await wait(1000);
      attendanceStore.completeEnrollment(studentId, "demo-facenet-v1");
      return;
    }

    const result = await requestEnrollmentProcessing({ studentId, imageMeta });
    attendanceStore.completeEnrollment(studentId, result.modelVersion || "facenet-v1");
  } catch (_error) {
    attendanceStore.invalidateEnrollment(studentId);
  }
}

export async function runAttendancePipeline({ studentId, jobId, imageMeta }) {
  try {
    if (env.enableDemoResolution) {
      await wait(1500);
      attendanceStore.resolveRecord(jobId, {
        status: "verified",
        faceScore: 0.91,
        livenessScore: 0.96
      });
      return;
    }

    const result = await requestAttendanceVerification({ studentId, jobId, imageMeta });
    attendanceStore.resolveRecord(jobId, {
      status: result.status,
      faceScore: result.faceScore,
      livenessScore: result.livenessScore
    });
  } catch (_error) {
    attendanceStore.resolveRecord(jobId, {
      status: "failed",
      faceScore: null,
      livenessScore: null
    });
  }
}
