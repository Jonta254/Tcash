import { APP_CONFIG, STORAGE_KEYS } from "../config/appConfig";
import { readStorage, removeStorage, writeStorage } from "./localStorage";

const seedAdminUser = {
  id: "admin-001",
  fullName: "WorldTMpesa Admin",
  phone: APP_CONFIG.admin.localPhone,
  mpesaPhoneNumber: APP_CONFIG.admin.localPhone,
  password: "Jonta@2003",
  walletAddress: APP_CONFIG.admin.worldWalletAddress,
  username: APP_CONFIG.admin.worldUsername || "tmpesa-admin",
  authMethod: "local",
  isAdmin: true,
  createdAt: new Date().toISOString(),
};

function normalizeUsername(username) {
  return String(username || "").trim().replace(/^@/, "").toLowerCase();
}

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

function upsertSeedAdmin(users) {
  const seededAdminIndex = users.findIndex((user) => user.id === seedAdminUser.id);

  if (seededAdminIndex === -1) {
    return [seedAdminUser, ...users];
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

  return nextUsers;
}

function getAdminPhoneAliases() {
  return new Set([
    seedAdminUser.phone,
    normalizePhone(seedAdminUser.phone),
    normalizePhone(`+254${seedAdminUser.phone.slice(1)}`),
    normalizePhone(seedAdminUser.phone.slice(1)),
  ]);
}

export function initializeUsers() {
  const users = readStorage(STORAGE_KEYS.users, []);
  const nextUsers = upsertSeedAdmin(users);
  writeStorage(STORAGE_KEYS.users, nextUsers);

  const currentUser = getCurrentUser();

  if (currentUser?.id === seedAdminUser.id) {
    writeStorage(STORAGE_KEYS.currentUser, {
      ...currentUser,
      phone: seedAdminUser.phone,
      mpesaPhoneNumber: seedAdminUser.mpesaPhoneNumber,
      password: seedAdminUser.password,
      username: seedAdminUser.username,
      isAdmin: true,
    });
  }
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

  writeStorage(STORAGE_KEYS.users, upsertSeedAdmin(nextUsers));
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

export function loginUser({ phone, password }) {
  const normalizedPhone = normalizePhone(phone);
  const normalizedPassword = normalizePassword(password);
  const users = upsertSeedAdmin(getUsers());
  const adminPhoneAliases = getAdminPhoneAliases();

  writeStorage(STORAGE_KEYS.users, users);

  const user = users.find(
    (entry) =>
      normalizePhone(entry.phone) === normalizedPhone &&
      normalizePassword(entry.password) === normalizedPassword,
  );

  if (
    !user &&
    adminPhoneAliases.has(normalizedPhone) &&
    normalizedPassword === seedAdminUser.password
  ) {
    writeStorage(STORAGE_KEYS.currentUser, seedAdminUser);
    return seedAdminUser;
  }

  if (!user) {
    throw new Error("Invalid phone number or password.");
  }

  writeStorage(STORAGE_KEYS.currentUser, user);
  return user;
}

export function loginAdmin({ phone, password }) {
  const normalizedPhone = normalizePhone(phone);
  const normalizedPassword = normalizePassword(password);
  const adminPhoneAliases = getAdminPhoneAliases();

  const isValidAdmin =
    adminPhoneAliases.has(normalizedPhone) &&
    normalizedPassword === normalizePassword(seedAdminUser.password);

  if (!isValidAdmin) {
    throw new Error("Invalid admin phone number or password.");
  }

  const nextUsers = upsertSeedAdmin(getUsers());
  writeStorage(STORAGE_KEYS.users, nextUsers);
  writeStorage(STORAGE_KEYS.currentUser, seedAdminUser);
  return seedAdminUser;
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
    firstAccessVerified: existingUser?.firstAccessVerified || false,
    firstAccessVerifiedAt: existingUser?.firstAccessVerifiedAt || null,
    firstAccessVerificationLevel: existingUser?.firstAccessVerificationLevel || "",
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
