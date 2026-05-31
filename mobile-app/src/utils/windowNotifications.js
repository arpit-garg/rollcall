function defaultFormatTime(value) {
  if (!value) {
    return "it closes";
  }

  return new Intl.DateTimeFormat("en-IN", {
    timeStyle: "short"
  }).format(new Date(value));
}

function getWindowOpenedNotification({
  hasLoadedCurrentWindow,
  previousWindow,
  nextWindow,
  formatTime = defaultFormatTime
}) {
  if (!nextWindow) {
    return null;
  }

  if (hasLoadedCurrentWindow && previousWindow?.id === nextWindow.id) {
    return null;
  }

  return `Attendance window is now open. Mark attendance before ${formatTime(nextWindow.closesAt || nextWindow.closes_at)}.`;
}

function getWindowNotificationMessage(notification, { formatTime = defaultFormatTime } = {}) {
  if (notification?.type !== "attendance_window_opened") {
    return notification?.message || null;
  }

  const closesAt = notification.metadata?.closesAt || notification.closesAt;

  if (!closesAt) {
    return notification.message || "Attendance window is now open.";
  }

  return `Attendance window is now open. Mark attendance before ${formatTime(closesAt)}.`;
}

module.exports = {
  getWindowOpenedNotification,
  getWindowNotificationMessage
};
