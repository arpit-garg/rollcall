export const SUPPORTED_DASHBOARD_ROLES = ["warden", "parent", "super_admin"];

export const DASHBOARD_DEMO_ACCOUNTS = [
  {
    role: "warden",
    label: "Warden",
    email: "warden@college.edu",
    password: "Warden@123"
  },
  {
    role: "parent",
    label: "Parent",
    email: "parent@college.edu",
    password: "Student@123"
  },
  {
    role: "super_admin",
    label: "Super Admin",
    email: "superadmin@college.edu",
    password: "Warden@123"
  }
];

const ROLE_SHELLS = {
  warden: {
    eyebrow: "Warden Console",
    title: "Hostel Attendance Control Room",
    description:
      "Monitor active windows, review student-wise attendance, and record verified manual overrides.",
    links: [
      { to: "/", label: "Dashboard" },
      { to: "/students", label: "Student Summary" },
      { to: "/overrides", label: "Override Log" }
    ]
  },
  parent: {
    eyebrow: "Parent Portal",
    title: "Child Attendance And Leave Desk",
    description:
      "Review your linked child's attendance trail and approve or reject pending leave requests from one dashboard.",
    links: [{ to: "/", label: "Dashboard" }]
  },
  super_admin: {
    eyebrow: "Super Admin Console",
    title: "Campus Access And Hostel Management",
    description:
      "Create hostels, provision wardens, and keep the campus operations roster aligned with the backend.",
    links: [{ to: "/", label: "Dashboard" }]
  }
};

export function isSupportedDashboardRole(role) {
  return SUPPORTED_DASHBOARD_ROLES.includes(role);
}

export function getRoleShell(role) {
  return ROLE_SHELLS[role] || null;
}

export function getDefaultRouteForRole(role) {
  return getRoleShell(role)?.links?.[0]?.to || "/";
}
