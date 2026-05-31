import assert from "node:assert/strict";
import test from "node:test";
import {
  getDefaultRouteForRole,
  getRoleShell,
  isSupportedDashboardRole
} from "../src/config/roleConfig.js";

test("supports every dashboard role required by the product", () => {
  assert.equal(isSupportedDashboardRole("warden"), true);
  assert.equal(isSupportedDashboardRole("parent"), true);
  assert.equal(isSupportedDashboardRole("super_admin"), true);
  assert.equal(isSupportedDashboardRole("student"), false);
});

test("keeps the warden shell focused on operations and student-wise review", () => {
  const shell = getRoleShell("warden");

  assert.equal(shell.eyebrow, "Warden Console");
  assert.deepEqual(
    shell.links.map((link) => link.to),
    ["/", "/students", "/overrides"]
  );
  assert.equal(getDefaultRouteForRole("warden"), "/");
});

test("gives parents a dedicated child attendance and leave approval shell", () => {
  const shell = getRoleShell("parent");

  assert.equal(shell.eyebrow, "Parent Portal");
  assert.deepEqual(
    shell.links.map((link) => link.to),
    ["/"]
  );
  assert.match(shell.description, /leave/i);
  assert.equal(getDefaultRouteForRole("parent"), "/");
});

test("gives super admins hostel and warden management access", () => {
  const shell = getRoleShell("super_admin");

  assert.equal(shell.eyebrow, "Super Admin Console");
  assert.deepEqual(
    shell.links.map((link) => link.to),
    ["/"]
  );
  assert.match(shell.description, /hostel/i);
  assert.equal(getDefaultRouteForRole("super_admin"), "/");
});
