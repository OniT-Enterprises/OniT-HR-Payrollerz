/**
 * Central download utility for triggering blob downloads.
 * Keeps the <a>.click() as close as possible to the user gesture
 * and uses a delayed URL.revokeObjectURL for Safari compatibility.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Delay revoke so Safari can finish reading the blob
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
