const STORAGE_KEY = "ritual:focus-alert";

export type FocusAlertPermission = NotificationPermission | "unsupported";

export type FocusAlertSnapshot = {
  enabled: boolean;
  permission: FocusAlertPermission;
};

const serverSnapshot: FocusAlertSnapshot = {
  enabled: false,
  permission: "default",
};

let snapshot: FocusAlertSnapshot = serverSnapshot;
let hydrated = false;
const listeners = new Set<() => void>();

function readPermission(): FocusAlertPermission {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

function readEnabled() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // The in-memory choice still applies for this visit.
  }
}

function publish(next: FocusAlertSnapshot) {
  if (snapshot.enabled === next.enabled && snapshot.permission === next.permission) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  const permission = readPermission();
  snapshot = {
    enabled: readEnabled() && permission === "granted",
    permission,
  };
}

export function subscribeFocusAlert(listener: () => void) {
  hydrate();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getFocusAlertSnapshot() {
  hydrate();
  return snapshot;
}

export function getFocusAlertServerSnapshot() {
  return serverSnapshot;
}

export function exportFocusAlertEnabled() {
  hydrate();
  return readEnabled();
}

export function applyFocusAlertEnabled(enabled: boolean) {
  hydrate();
  writeEnabled(enabled);
  const permission = readPermission();
  publish({ enabled: enabled && permission === "granted", permission });
}

export async function setFocusAlertEnabled(nextEnabled: boolean) {
  hydrate();
  if (!nextEnabled) {
    writeEnabled(false);
    publish({ enabled: false, permission: readPermission() });
    return;
  }

  const current = readPermission();
  if (current === "unsupported") {
    writeEnabled(false);
    publish({ enabled: false, permission: "unsupported" });
    return;
  }

  let permission = current;
  if (permission === "default") {
    try {
      permission = await Notification.requestPermission();
    } catch {
      permission = Notification.permission;
    }
  }

  const enabled = permission === "granted";
  writeEnabled(enabled);
  publish({ enabled, permission });
}

function focusAlertBody(minutes: number, todoTitle: string | null) {
  if (todoTitle) return `${todoTitle}에 ${minutes}분을 기록했습니다. 5분 휴식하세요.`;
  if (minutes > 0) return `집중 ${minutes}분을 마쳤습니다. 5분 휴식하세요.`;
  return "집중 세션을 마쳤습니다. 5분 휴식하세요.";
}

export function notifyFocusEnded(input: { minutes: number; todoTitle: string | null }) {
  hydrate();
  const permission = readPermission();
  const enabled = snapshot.enabled && permission === "granted";
  publish({ enabled, permission });
  if (!enabled) return;

  try {
    const notification = new Notification("집중 시간이 끝났습니다", {
      body: focusAlertBody(input.minutes, input.todoTitle),
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "ritual-focus-complete",
      lang: "ko",
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // A revoked permission should not block the session record.
  }
}
