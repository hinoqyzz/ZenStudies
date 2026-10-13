export type ThemePreference = "light" | "dark" | "system";
export type MotionPreference = "full" | "reduced" | "off";

export interface Preferences {
  theme: ThemePreference;
  editorFontSize: number;
  readingWidth: number;
  motion: MotionPreference;
  focusMinutes: number;
  reviewEnabled: boolean;
  reviewHour: number;
  reviewMinute: number;
  notificationsEnabled: boolean;
  notifyFocusEnd: boolean;
  notifyReviews: boolean;
  notifySaveFailure: boolean;
  closeToTray: boolean;
  closeToTrayExplained: boolean;
  startWithWindows: boolean;
  preloaderSeen: boolean;
  sidebarCollapsed: boolean;
  inspectorCollapsed: boolean;
}

export const PREFERENCE_DEFAULTS: Preferences = {
  theme: "system",
  editorFontSize: 17,
  readingWidth: 720,
  motion: "full",
  focusMinutes: 25,
  reviewEnabled: false,
  reviewHour: 18,
  reviewMinute: 0,
  notificationsEnabled: false,
  notifyFocusEnd: true,
  notifyReviews: true,
  notifySaveFailure: true,
  closeToTray: false,
  closeToTrayExplained: false,
  startWithWindows: false,
  preloaderSeen: false,
  sidebarCollapsed: false,
  inspectorCollapsed: false,
};

const STORAGE_KEY = "zenstudies.preferences";

export function sanitizePreferences(value: unknown): Preferences {
  const source = value && typeof value === "object" ? (value as Partial<Preferences>) : {};
  const theme = source.theme === "light" || source.theme === "dark" || source.theme === "system" ? source.theme : PREFERENCE_DEFAULTS.theme;
  const motion = source.motion === "full" || source.motion === "reduced" || source.motion === "off" ? source.motion : PREFERENCE_DEFAULTS.motion;
  return {
    theme,
    editorFontSize: clamp(source.editorFontSize, 15, 20, PREFERENCE_DEFAULTS.editorFontSize),
    readingWidth: clamp(source.readingWidth, 640, 760, PREFERENCE_DEFAULTS.readingWidth),
    motion,
    focusMinutes: clamp(source.focusMinutes, 5, 180, PREFERENCE_DEFAULTS.focusMinutes),
    reviewEnabled: Boolean(source.reviewEnabled),
    reviewHour: clamp(source.reviewHour, 0, 23, PREFERENCE_DEFAULTS.reviewHour),
    reviewMinute: clamp(source.reviewMinute, 0, 59, PREFERENCE_DEFAULTS.reviewMinute),
    notificationsEnabled: Boolean(source.notificationsEnabled),
    notifyFocusEnd: source.notifyFocusEnd !== false,
    notifyReviews: source.notifyReviews !== false,
    notifySaveFailure: source.notifySaveFailure !== false,
    closeToTray: Boolean(source.closeToTray),
    closeToTrayExplained: Boolean(source.closeToTrayExplained),
    startWithWindows: Boolean(source.startWithWindows),
    preloaderSeen: Boolean(source.preloaderSeen),
    sidebarCollapsed: Boolean(source.sidebarCollapsed),
    inspectorCollapsed: Boolean(source.inspectorCollapsed),
  };
}

export function loadPreferences(storage: Pick<Storage, "getItem"> | null = defaultStorage()): Preferences {
  if (!storage) return { ...PREFERENCE_DEFAULTS };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...PREFERENCE_DEFAULTS };
    return sanitizePreferences(JSON.parse(raw));
  } catch {
    return { ...PREFERENCE_DEFAULTS };
  }
}

export function savePreferences(preferences: Preferences, storage: Pick<Storage, "setItem"> | null = defaultStorage()): void {
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(sanitizePreferences(preferences)));
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): "light" | "dark" {
  if (preference === "system") return systemDark ? "dark" : "light";
  return preference;
}

export function resolveMotion(preference: MotionPreference, systemReduced: boolean): MotionPreference {
  if (preference === "off") return "off";
  if (preference === "reduced" || systemReduced) return "reduced";
  return "full";
}

export function preferencesForBackup(preferences: Preferences) {
  return {
    theme: preferences.theme,
    editorFontSize: preferences.editorFontSize,
    readingWidth: preferences.readingWidth,
    motion: preferences.motion,
    focusMinutes: preferences.focusMinutes,
    reviewEnabled: preferences.reviewEnabled,
    reviewHour: preferences.reviewHour,
    reviewMinute: preferences.reviewMinute,
    notificationsEnabled: preferences.notificationsEnabled,
    notifyFocusEnd: preferences.notifyFocusEnd,
    notifyReviews: preferences.notifyReviews,
    notifySaveFailure: preferences.notifySaveFailure,
    closeToTray: preferences.closeToTray,
    startWithWindows: preferences.startWithWindows,
  };
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function defaultStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}
