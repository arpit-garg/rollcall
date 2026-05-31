const assert = require("node:assert/strict");
const { test } = require("node:test");
const { removeReadNotification } = require("../src/utils/notifications.js");

test("removing a read notification keeps unread items in the bell list", () => {
  const notifications = [
    { id: "notification-1", title: "Window open" },
    { id: "notification-2", title: "Leave approved" }
  ];

  const remaining = removeReadNotification(notifications, "notification-1");

  assert.deepEqual(remaining, [{ id: "notification-2", title: "Leave approved" }]);
  assert.equal(notifications.length, 2);
});
