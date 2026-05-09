import { appendAuditLog } from "../repositories/auditLogsRepository.js";
import {
  closeWindow as closeWindowRecord,
  createWindow as createWindowRecord,
  getWindowRecords,
  findActiveWindow,
  listWindows
} from "../repositories/windowsRepository.js";
import { httpError } from "./httpError.js";

export async function openWindow({ hostelId, openedBy, opensAt, closesAt }) {
  if (new Date(closesAt).getTime() <= new Date(opensAt).getTime()) {
    throw httpError(400, "VALIDATION_ERROR", "closes_at must be after opens_at");
  }

  const window = await createWindowRecord({
    hostelId,
    openedBy,
    opensAt,
    closesAt
  });

  await appendAuditLog(openedBy, "WINDOW_OPENED", "attendance_windows", window.id, {
    opensAt,
    closesAt
  });

  return window;
}

export async function closeWindow({ windowId, hostelId, actorId }) {
  const window = await closeWindowRecord(windowId, hostelId);

  if (!window) {
    throw httpError(404, "NOT_FOUND", "Attendance window not found");
  }

  await appendAuditLog(actorId, "WINDOW_CLOSED", "attendance_windows", window.id, {});
  return window;
}

export async function listHostelWindows(hostelId) {
  return listWindows(hostelId);
}

export async function getCurrentWindowForHostel(hostelId) {
  return findActiveWindow(hostelId);
}

export async function listRecordsForWindow(windowId, hostelId) {
  return getWindowRecords(windowId, hostelId);
}
