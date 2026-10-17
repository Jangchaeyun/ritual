export type ThemeId = "light" | "dark";

const STORAGE_KEY = "ritual:theme";
const listeners = new Set<() => void>();

export function isThemeId(value: unknown): value is ThemeId {
  return value === "light" || value === "dark";
}

export function exportTheme(): ThemeId {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/**
 * 밝은 테마는 `data-theme`를 지워서 서버가 그린 기본값과 같게 둡니다.
 * 어두운 테마만 속성을 붙여, 첫 화면이 밝았다가 갑자기 바뀌지 않게 합니다.
 */
export function applyTheme(theme: ThemeId) {
  if (typeof document !== "undefined") {
    if (theme === "dark") document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#141311" : "#f3f0ea");
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* private mode */
  }
  for (const listener of listeners) listener();
}

export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
