import { env } from "../config/env.js";
import { resolveAttendanceRecord } from "./attendanceService.js";
import {
  completeEnrollment,
  markReEnrollmentRequired
} from "./enrollmentService.js";
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
      await completeEnrollment(studentId, "demo-facenet-v1");
      return;
    }

    const result = await requestEnrollmentProcessing({ studentId, imageMeta });
    await completeEnrollment(studentId, result.modelVersion || "facenet-v1");
  } catch (_error) {
    await markReEnrollmentRequired(studentId);
  }
}

export async function runAttendancePipeline({ jobId, imageMeta }) {
  try {
    if (env.enableDemoResolution) {
      await wait(1500);
      await resolveAttendanceRecord(jobId, {
        status: "verified",
        faceScore: 0.91,
        livenessScore: 0.96
      });
      return;
    }

    const result = await requestAttendanceVerification({ studentId, jobId, imageMeta });
    await resolveAttendanceRecord(jobId, {
      status: result.status,
      faceScore: result.faceScore,
      livenessScore: result.livenessScore
    });
  } catch (_error) {
    await resolveAttendanceRecord(jobId, {
      status: "failed",
      faceScore: null,
      livenessScore: null
    });
  }
}
