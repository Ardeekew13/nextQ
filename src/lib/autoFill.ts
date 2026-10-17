/**
 * "Auto-fill court after a result": a per-device preference. When on, recording a result puts
 * the next game from the queue on that court straight away (picked on this device, announced,
 * and synced in the background). On by default.
 */
const KEY = "nextq.autoFillAfterResult.v1";

export function loadAutoFill(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function saveAutoFill(on: boolean): void {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* storage unavailable: the choice lasts until the page reloads */
  }
}
