const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  getWindowOpenedNotification,
  getWindowNotificationMessage
} = require("../src/utils/windowNotifications.js");

test("notifies on first load when an attendance window is already open", () => {
  const notification = getWindowOpenedNotification({
    hasLoadedCurrentWindow: false,
    previousWindow: null,
    nextWindow: {
      id: "window-1",
      closesAt: "2026-05-30T22:30:00.000Z"
    },
    formatTime: () => "10:30 PM"
  });

  assert.equal(
    notification,
    "Attendance window is now open. Mark attendance before 10:30 PM."
  );
});

test("notifies when a hostel current-window changes from closed to open", () => {
  const notification = getWindowOpenedNotification({
    hasLoadedCurrentWindow: true,
    previousWindow: null,
    nextWindow: {
      id: "window-1",
      closesAt: "2026-05-30T22:30:00.000Z"
    },
    formatTime: () => "10:30 PM"
  });

  assert.equal(
    notification,
    "Attendance window is now open. Mark attendance before 10:30 PM."
  );
});

test("does not repeat the notification for the same open window", () => {
  const previousWindow = {
    id: "window-1",
    closesAt: "2026-05-30T22:30:00.000Z"
  };
  const notification = getWindowOpenedNotification({
    hasLoadedCurrentWindow: true,
    previousWindow,
    nextWindow: previousWindow
  });

  assert.equal(notification, null);
});

test("formats a persisted window-open notification with the close time", () => {
  const message = getWindowNotificationMessage(
    {
      type: "attendance_window_opened",
      message: "Attendance window is now open.",
      metadata: {
        closesAt: "2026-05-30T22:30:00.000Z"
      }
    },
    {
      formatTime: () => "10:30 PM"
    }
  );

  assert.equal(message, "Attendance window is now open. Mark attendance before 10:30 PM.");
});
