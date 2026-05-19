import { useEffect, useState } from "react";
import { getTheme, setTheme, subscribeToTheme } from "../services/themeService";

export function useThemeMode() {
  const [theme, setThemeState] = useState(() => getTheme());

  useEffect(() => subscribeToTheme(setThemeState), []);

  const updateTheme = (nextTheme) => {
    setThemeState(setTheme(nextTheme));
  };

  return {
    theme,
    isLightTheme: theme === "light",
    setTheme: updateTheme,
    toggleTheme: () => updateTheme(theme === "light" ? "dark" : "light"),
  };
}
