import { env } from "../config/env.js";

export async function requestEnrollmentProcessing({ studentId, imageObjectKey }) {
  const response = await fetch(`${env.mlServiceUrl}/api/v1/internal/enroll`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      studentId,
      imageObjectKey
    })
  });

  if (!response.ok) {
    throw new Error("ML enrollment request failed");
  }

  return response.json();
}

export async function requestAttendanceVerification({ studentId, jobId, imageObjectKey, templateRef }) {
  const response = await fetch(`${env.mlServiceUrl}/api/v1/internal/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      studentId,
      jobId,
      imageObjectKey,
      templateRef,
      similarityThreshold: env.similarityThreshold,
      livenessThreshold: env.livenessThreshold
    })
  });

  if (!response.ok) {
    throw new Error("ML verification request failed");
  }

  return response.json();
}
