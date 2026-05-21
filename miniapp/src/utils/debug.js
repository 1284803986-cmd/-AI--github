import Taro from "@tarojs/taro";

const DEBUG_STORAGE_KEY = "miniapp_debug_log_enabled";

export function isDebugLogEnabled() {
  try {
    const stored = Taro.getStorageSync(DEBUG_STORAGE_KEY);
    if (typeof stored === "boolean") return stored;
  } catch {
    // Storage may be unavailable during early app startup.
  }
  if (typeof process !== "undefined" && process?.env?.NODE_ENV) {
    return process.env.NODE_ENV !== "production";
  }
  return false;
}

export function debugLog(label, payload) {
  if (!isDebugLogEnabled()) return;
  console.info(label, payload);
}

export function debugWarn(label, payload) {
  if (!isDebugLogEnabled()) return;
  console.warn(label, payload);
}
