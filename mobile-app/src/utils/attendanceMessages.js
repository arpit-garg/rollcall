function formatScore(score) {
  if (score === null || score === undefined) {
    return null;
  }

  const numericScore = Number(score);

  if (!Number.isFinite(numericScore)) {
    return null;
  }

  return `${Math.round(numericScore * 100)}%`;
}

function formatScoreSummary(result) {
  const faceScore = formatScore(result?.faceScore);
  const livenessScore = formatScore(result?.livenessScore);

  if (faceScore && livenessScore) {
    return `Face match ${faceScore}, liveness ${livenessScore}.`;
  }

  if (faceScore) {
    return `Face match ${faceScore}, liveness not scored.`;
  }

  if (livenessScore) {
    return `Face match not scored, liveness ${livenessScore}.`;
  }

  return null;
}

function getVerificationResultMessage(result) {
  if (result?.status === "verified") {
    const scoreSummary = formatScoreSummary(result);
    return scoreSummary
      ? `Attendance verified successfully. ${scoreSummary}`
      : "Attendance verified successfully.";
  }

  if (result?.status === "failed") {
    const scoreSummary = formatScoreSummary(result);
    return scoreSummary
      ? `Attendance verification failed. ${scoreSummary}`
      : "Attendance verification failed before scoring. Re-enroll your face and try again.";
  }

  return "Attendance verification is processing. We will update this screen when it finishes.";
}

module.exports = {
  getVerificationResultMessage
};
