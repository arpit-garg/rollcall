import { env } from "../config/env.js";

export async function requestEnrollmentProcessing({ studentId, imageMeta }) {
  const response = await fetch(`${env.mlServiceUrl}/api/v1/internal/enroll`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      studentId,
      imageName: imageMeta?.originalname || "camera-capture.jpg"
    })
  });

  if (!response.ok) {
    throw new Error("ML enrollment request failed");
  }

  return response.json();
}

export async function requestAttendanceVerification({ studentId, jobId, imageMeta }) {
  const response = await fetch(`${env.mlServiceUrl}/api/v1/internal/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      studentId,
      jobId,
      imageName: imageMeta?.originalname || "camera-capture.jpg",
      similarityThreshold: env.similarityThreshold,
      livenessThreshold: env.livenessThreshold
    })
  });

  if (!response.ok) {
    throw new Error("ML verification request failed");
  }

  return response.json();
}
