import { appendAuditLog } from "../repositories/auditLogsRepository.js";
import {
  createLeaveRequest as createLeaveRequestRecord,
  decideLeaveRequest,
  listLeaveRequestsForParent,
  listLeaveRequestsForStudent
} from "../repositories/leaveRequestsRepository.js";
import { findParentLinkByStudentId } from "../repositories/parentLinksRepository.js";
import { httpError } from "./httpError.js";

function parseDateOnly(value, fieldName) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw httpError(400, "VALIDATION_ERROR", `${fieldName} must be a valid YYYY-MM-DD date`);
  }

  const parsed = new Date(`${value.trim()}T00:00:00.000Z`);

  if (!Number.isFinite(parsed.getTime())) {
    throw httpError(400, "VALIDATION_ERROR", `${fieldName} must be a valid YYYY-MM-DD date`);
  }

  return value.trim();
}

export async function createLeaveRequest({
  studentId,
  requestedFrom,
  requestedTo,
  destination,
  reason
}) {
  const normalizedRequestedFrom = parseDateOnly(requestedFrom, "requestedFrom");
  const normalizedRequestedTo = parseDateOnly(requestedTo, "requestedTo");
  const normalizedDestination = typeof destination === "string" ? destination.trim() : "";
  const normalizedReason = typeof reason === "string" ? reason.trim() : "";

  if (!normalizedDestination || !normalizedReason) {
    throw httpError(400, "VALIDATION_ERROR", "destination and reason are required");
  }

  if (normalizedRequestedTo < normalizedRequestedFrom) {
    throw httpError(400, "VALIDATION_ERROR", "requestedTo must be on or after requestedFrom");
  }

  const parentLink = await findParentLinkByStudentId(studentId);

  if (!parentLink?.parentId) {
    throw httpError(409, "PARENT_LINK_REQUIRED", "A linked parent account is required before requesting leave");
  }

  const leaveRequest = await createLeaveRequestRecord({
    studentId,
    parentId: parentLink.parentId,
    requestedFrom: normalizedRequestedFrom,
    requestedTo: normalizedRequestedTo,
    destination: normalizedDestination,
    reason: normalizedReason
  });

  await appendAuditLog(studentId, "LEAVE_REQUEST_CREATED", "leave_requests", leaveRequest.id, {
    requestedFrom: leaveRequest.requestedFrom,
    requestedTo: leaveRequest.requestedTo
  });

  return leaveRequest;
}

export async function getLeaveRequestsForUser({ userId, role }) {
  if (role === "student") {
    return listLeaveRequestsForStudent(userId);
  }

  if (role === "parent") {
    return listLeaveRequestsForParent(userId);
  }

  throw httpError(403, "FORBIDDEN", "Only students and parents can view leave requests");
}

export async function decideLeaveRequestForParent({ requestId, parentId, decision, note }) {
  const normalizedDecision = typeof decision === "string" ? decision.trim().toLowerCase() : "";

  if (!["approved", "rejected"].includes(normalizedDecision)) {
    throw httpError(400, "VALIDATION_ERROR", "decision must be approved or rejected");
  }

  const leaveRequest = await decideLeaveRequest({
    requestId,
    parentId,
    status: normalizedDecision,
    parentNote: typeof note === "string" ? note.trim() || null : null
  });

  if (!leaveRequest) {
    throw httpError(404, "NOT_FOUND", "Leave request not found");
  }

  await appendAuditLog(parentId, "LEAVE_REQUEST_DECIDED", "leave_requests", leaveRequest.id, {
    status: leaveRequest.status,
    parentNote: leaveRequest.parentNote
  });

  return leaveRequest;
}
