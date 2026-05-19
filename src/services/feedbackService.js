import { STORAGE_KEYS } from "../config/appConfig";
import { readStorage, writeStorage } from "./localStorage";

export function getRatingSummary() {
  const ratings = readStorage(STORAGE_KEYS.ratings, {});
  const values = Object.values(ratings).map((entry) => Number(entry?.rating || 0)).filter(Boolean);
  const totalRatings = values.length;
  const averageRating = totalRatings
    ? Math.round((values.reduce((sum, value) => sum + value, 0) / totalRatings) * 10) / 10
    : 0;

  return {
    totalRatings,
    averageRating,
  };
}

export function saveUserRating(user, rating) {
  const numericRating = Number(rating);

  if (!user?.id) {
    throw new Error("Sign in before rating TMpesa.");
  }

  if (!numericRating || numericRating < 1 || numericRating > 5) {
    throw new Error("Choose a rating between 1 and 5.");
  }

  const ratings = readStorage(STORAGE_KEYS.ratings, {});
  ratings[user.id] = {
    rating: numericRating,
    updatedAt: new Date().toISOString(),
  };

  writeStorage(STORAGE_KEYS.ratings, ratings);
  return getRatingSummary();
}
