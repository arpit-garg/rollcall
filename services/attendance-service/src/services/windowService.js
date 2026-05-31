import { appendAuditLog } from "../repositories/auditLogsRepository.js";
import { createWindowOpenedNotificationsForHostel } from "../repositories/notificationsRepository.js";
import {
  closeWindow as closeWindowRecord,
  createWindow as createWindowRecord,
  getWindowRecords,
  getWindowRoster,
  findActiveWindow,
  listWindows,
  findOverlappingWindow
} from "../repositories/windowsRepository.js";
import { httpError } from "./httpError.js";
import { emitWindowOpened } from "./socketEmitter.js";

function parseDateTime(value, fieldName) {
  const parsed = new Date(value);

  if (!Number.isFinite(parsed.getTime())) {
    throw httpError(400, "VALIDATION_ERROR", `${fieldName} must be a valid ISO date`);
  }

  return parsed;
}

export async function openWindow({ hostelId, openedBy, opensAt, closesAt }) {
  const parsedOpensAt = parseDateTime(opensAt, "opens_at");
  const parsedClosesAt = parseDateTime(closesAt, "closes_at");

  if (parsedClosesAt.getTime() <= parsedOpensAt.getTime()) {
    throw httpError(400, "VALIDATION_ERROR", "closes_at must be after opens_at");
  }

  const overlapping = await findOverlappingWindow(hostelId, opensAt, closesAt);
  if (overlapping) {
    throw httpError(409, "OVERLAPPING_WINDOW", "An active attendance window already overlaps with the requested time range");
  }

  const result = await createWindowRecord({
    hostelId,
    openedBy,
    opensAt,
    closesAt
  });

  if (result.overlapping) {
    throw httpError(409, "OVERLAPPING_WINDOW", "An active attendance window already overlaps with the requested time range");
  }

  const { window } = result;

  await appendAuditLog(openedBy, "WINDOW_OPENED", "attendance_windows", window.id, {
    opensAt,
    closesAt
  });
  await createWindowOpenedNotificationsForHostel({ hostelId, window });
  emitWindowOpened(window);

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

export async function listRosterForWindow(windowId, hostelId) {
  return getWindowRoster(windowId, hostelId);
}
