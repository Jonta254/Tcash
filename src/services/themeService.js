import { STORAGE_KEYS } from "../config/appConfig";
import { readStorage, writeStorage } from "./localStorage";

const THEME_UPDATED_EVENT = "worldtmpesa:theme-updated";
const DEFAULT_THEME = "dark";

function emitTheme(theme) {
  window.dispatchEvent(new CustomEvent(THEME_UPDATED_EVENT, { detail: theme }));
}

function normalizeTheme(theme) {
  return theme === "light" ? "light" : DEFAULT_THEME;
}

export function getTheme() {
  return normalizeTheme(readStorage(STORAGE_KEYS.appTheme, DEFAULT_THEME));
}

export function applyTheme(theme) {
  const nextTheme = normalizeTheme(theme);

  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", nextTheme);
    document.documentElement.style.colorScheme = nextTheme === "light" ? "light" : "dark";
  }

  return nextTheme;
}

export function initializeTheme() {
  return applyTheme(getTheme());
}

export function setTheme(theme) {
  const nextTheme = normalizeTheme(theme);
  writeStorage(STORAGE_KEYS.appTheme, nextTheme);
  applyTheme(nextTheme);
  emitTheme(nextTheme);
  return nextTheme;
}

export function subscribeToTheme(callback) {
  const handleTheme = (event) => callback(event.detail);

  window.addEventListener(THEME_UPDATED_EVENT, handleTheme);

  return () => {
    window.removeEventListener(THEME_UPDATED_EVENT, handleTheme);
  };
}
