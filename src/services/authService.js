import { STORAGE_KEYS } from "../config/appConfig";
import { readStorage, removeStorage, writeStorage } from "./localStorage";

const seedAdminUser = {
  id: "admin-001",
  fullName: "WorldTMpesa Admin",
  phone: "0795621901",
  mpesaPhoneNumber: "0795621901",
  password: "Jonta@2003",
  walletAddress: "",
  username: "tmpesa-admin",
  authMethod: "local",
  isAdmin: true,
  createdAt: new Date().toISOString(),
};

export function initializeUsers() {
  const users = readStorage(STORAGE_KEYS.users, []);
  const seededAdminIndex = users.findIndex((user) => user.id === seedAdminUser.id);

  if (seededAdminIndex === -1) {
    writeStorage(STORAGE_KEYS.users, [seedAdminUser, ...users]);
    return;
  }

  const nextUsers = [...users];
  nextUsers[seededAdminIndex] = {
    ...nextUsers[seededAdminIndex],
    phone: seedAdminUser.phone,
    mpesaPhoneNumber: seedAdminUser.mpesaPhoneNumber,
    password: seedAdminUser.password,
    username: seedAdminUser.username,
    isAdmin: true,
  };

  writeStorage(STORAGE_KEYS.users, nextUsers);
}

export function getUsers() {
  return readStorage(STORAGE_KEYS.users, []);
}

export function getCurrentUser() {
  return readStorage(STORAGE_KEYS.currentUser, null);
}

export function findUserByUsername(username) {
  if (!username?.trim()) {
    return null;
  }

  const normalizedUsername = username.trim().replace(/^@/, "").toLowerCase();
  return (
    getUsers().find((user) => (user.username || "").trim().replace(/^@/, "").toLowerCase() === normalizedUsername) ||
    null
  );
}

export function findUserByWalletAddress(walletAddress) {
  if (!walletAddress?.trim()) {
    return null;
  }

  const normalizedWallet = walletAddress.trim().toLowerCase();
  return (
    getUsers().find((user) => (user.walletAddress || "").trim().toLowerCase() === normalizedWallet) ||
    null
  );
}

export function isUserAccessVerified(user) {
  if (!user) {
    return false;
  }

  if (user.isAdmin || user.authMethod !== "world-app") {
    return true;
  }

  return Boolean(user.firstAccessVerified);
}

export function signupUser(payload) {
  const users = getUsers();
  const exists = users.some((user) => user.phone === payload.phone);

  if (exists) {
    throw new Error("A user with that phone number already exists.");
  }

  const user = {
    id: crypto.randomUUID(),
    fullName: payload.fullName,
    phone: payload.phone,
    mpesaPhoneNumber: payload.mpesaPhoneNumber,
    password: payload.password,
    walletAddress: "",
    username: "",
    authMethod: "local",
    isAdmin: false,
    createdAt: new Date().toISOString(),
  };

  writeStorage(STORAGE_KEYS.users, [...users, user]);
  writeStorage(STORAGE_KEYS.currentUser, user);
  return user;
}

export function loginUser({ phone, password }) {
  const user = getUsers().find((entry) => entry.phone === phone && entry.password === password);

  if (!user) {
    throw new Error("Invalid phone number or password.");
  }

  writeStorage(STORAGE_KEYS.currentUser, user);
  return user;
}

export function loginWithWorldApp(profile, changes = {}) {
  const users = getUsers();
  const existingUser = findUserByWalletAddress(profile.walletAddress) || findUserByUsername(profile.username);
  const user = {
    id: existingUser?.id || crypto.randomUUID(),
    fullName: profile.fullName || profile.username || "World App user",
    phone: existingUser?.phone || "",
    mpesaPhoneNumber: existingUser?.mpesaPhoneNumber || "",
    password: existingUser?.password || "",
    walletAddress: profile.walletAddress,
    username: profile.username || existingUser?.username || "",
    authMethod: "world-app",
    preferredCurrency: profile.preferredCurrency || "KES",
    worldAppVersion: profile.worldAppVersion || null,
    firstAccessVerified: existingUser?.firstAccessVerified || false,
    firstAccessVerifiedAt: existingUser?.firstAccessVerifiedAt || null,
    firstAccessVerificationLevel: existingUser?.firstAccessVerificationLevel || "",
    isAdmin: existingUser?.isAdmin || false,
    createdAt: existingUser?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...changes,
  };

  const nextUsers = existingUser
    ? users.map((entry) => (entry.id === existingUser.id ? user : entry))
    : [...users, user];

  writeStorage(STORAGE_KEYS.users, nextUsers);
  writeStorage(STORAGE_KEYS.currentUser, user);
  return user;
}

export function updateCurrentUserProfile(changes) {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    throw new Error("You must be logged in to update your profile.");
  }

  const nextUser = {
    ...currentUser,
    ...changes,
    updatedAt: new Date().toISOString(),
  };

  const users = getUsers().map((user) => (user.id === currentUser.id ? nextUser : user));
  writeStorage(STORAGE_KEYS.users, users);
  writeStorage(STORAGE_KEYS.currentUser, nextUser);
  return nextUser;
}

export function logoutUser() {
  removeStorage(STORAGE_KEYS.currentUser);
}
