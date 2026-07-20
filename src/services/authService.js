import { APP_CONFIG, STORAGE_KEYS } from "../config/appConfig";
import { readStorage, removeStorage, writeStorage } from "./localStorage";

function normalizeUsername(username) {
  return String(username || "").trim().replace(/^@/, "").toLowerCase();
}

// This is a UI convenience only — it never gates access to anything.
// The real admin authorization decision happens exclusively on the
// server (api/_lib/adminAuth.js), checked against the signed SIWE
// session cookie, and is what actually decides whether the Admin
// Console renders or accepts a write (see useAdminSession /
// api/admin-session.js). Everywhere this flag is read client-side, it's
// for cosmetic or same-browser-only purposes (e.g. filtering this
// browser's own locally-cached order list) that carry no real
// financial or data-access consequence if a user manually edited it in
// devtools — there is nothing privileged left behind this flag.
function isConfiguredWorldAdmin(profile) {
  const configuredWallet = String(APP_CONFIG.admin.worldWalletAddress || "").trim().toLowerCase();
  const configuredUsername = normalizeUsername(APP_CONFIG.admin.worldUsername);
  const wallet = String(profile?.walletAddress || "").trim().toLowerCase();
  const username = normalizeUsername(profile?.username);

  if (configuredWallet && wallet && wallet === configuredWallet) {
    return true;
  }

  if (configuredUsername && username && username === configuredUsername) {
    return true;
  }

  return false;
}

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("254") && digits.length === 12) {
    return `0${digits.slice(3)}`;
  }

  if (digits.length === 9) {
    return `0${digits}`;
  }

  return digits;
}

function normalizePassword(password) {
  return String(password || "").trim();
}

export function getUsers() {
  return readStorage(STORAGE_KEYS.users, []);
}

export function getCurrentUser() {
  const currentUser = readStorage(STORAGE_KEYS.currentUser, null);

  if (!currentUser) {
    return null;
  }

  if (currentUser.isAdmin || !isConfiguredWorldAdmin(currentUser)) {
    return currentUser;
  }

  const nextUser = { ...currentUser, isAdmin: true };
  const nextUsers = getUsers().map((user) =>
    user.id === currentUser.id ? { ...user, isAdmin: true } : user,
  );

  writeStorage(STORAGE_KEYS.users, nextUsers);
  writeStorage(STORAGE_KEYS.currentUser, nextUser);
  return nextUser;
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
  return Boolean(user);
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

// Local phone/password login for non-admin accounts created via
// signupUser. There is no admin variant of this — admin identity is
// established exclusively through World App (loginWithWorldApp below)
// and verified server-side (api/_lib/adminAuth.js), never through a
// phone/password form.
export function loginUser({ phone, password }) {
  const normalizedPhone = normalizePhone(phone);
  const normalizedPassword = normalizePassword(password);
  const users = getUsers();

  const user = users.find(
    (entry) =>
      normalizePhone(entry.phone) === normalizedPhone &&
      normalizePassword(entry.password) === normalizedPassword,
  );

  if (!user) {
    throw new Error("Invalid phone number or password.");
  }

  writeStorage(STORAGE_KEYS.currentUser, user);
  return user;
}

export function loginWithWorldApp(profile, changes = {}) {
  const users = getUsers();
  const existingUser = findUserByWalletAddress(profile.walletAddress) || findUserByUsername(profile.username);
  const isWorldAdmin = isConfiguredWorldAdmin(profile) || existingUser?.isAdmin;
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
    isAdmin: isWorldAdmin,
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
