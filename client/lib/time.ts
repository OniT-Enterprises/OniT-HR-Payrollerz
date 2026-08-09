/** Normalize a stored HH:MM clock value for the app's 24-hour UI. */
export function formatTime24(value: string): string {
  if (!value) return "";
  const [hStr, mStr] = value.split(":");
  const hour = Number.parseInt(hStr, 10);
  const minute = Number.parseInt(mStr, 10);
  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) return "";
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

