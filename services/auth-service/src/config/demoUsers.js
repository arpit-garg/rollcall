import bcrypt from "bcryptjs";

const demoHostelId = "0f68b6d1-a7cf-47cf-b23e-7e4ff6ca58a4";

export const demoUsers = [
  {
    id: "8f71928b-74d0-4dbb-b30a-1e5da85a20fd",
    name: "Aarav Student",
    email: "student@college.edu",
    passwordHash: bcrypt.hashSync("Student@123", 10),
    role: "student",
    hostelId: demoHostelId,
    roomNumber: "A-102",
    isActive: true
  },
  {
    id: "54c1feaf-7bb9-4cc7-ac54-f1ed08dcb22c",
    name: "Meera Warden",
    email: "warden@college.edu",
    passwordHash: bcrypt.hashSync("Warden@123", 10),
    role: "warden",
    hostelId: demoHostelId,
    roomNumber: null,
    isActive: true
  }
];
