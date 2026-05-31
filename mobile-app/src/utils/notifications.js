function removeReadNotification(notifications, notificationId) {
  if (!Array.isArray(notifications)) {
    return [];
  }

  return notifications.filter((notification) => notification.id !== notificationId);
}

module.exports = {
  removeReadNotification
};
