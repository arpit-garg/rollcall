const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");

test("nginx proxies leave routes to attendance-service", () => {
  const conf = fs.readFileSync("nginx/nginx.conf", "utf8");

  assert.match(
    conf,
    /location \/api\/v1\/leaves\/ \{\s+proxy_pass http:\/\/attendance-service:3002\/api\/v1\/leaves\//m
  );
});
