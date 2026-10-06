export function normalizeKenyanPhone(value) {
  const phone = String(value || "").replace(/[\s()-]/g, "");
  if (/^\+?254[17]\d{8}$/.test(phone)) return `0${phone.replace(/^\+/, "").slice(3)}`;
  return /^0[17]\d{8}$/.test(phone) ? phone : null;
}
export function validMpesaCode(value) {
  return /^[A-Z0-9]{10}$/.test(String(value || "").trim().toUpperCase());
}
