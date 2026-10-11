"use client";

import { useCallback, useSyncExternalStore } from "react";

type StorageOptions<T> = {
  validate?: (value: unknown) => value is T;
  revive?: (value: T) => T;
};

type CacheEntry = {
  value: unknown;
};

const cache = new Map<string, CacheEntry>();
const listeners = new Map<string, Set<() => void>>();

function emit(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

function subscribeKey(key: string, listener: () => void) {
  let bucket = listeners.get(key);
  if (!bucket) {
    bucket = new Set();
    listeners.set(key, bucket);
  }
  bucket.add(listener);
  return () => {
    bucket.delete(listener);
  };
}

function loadValue<T>(key: string, initial: T, options?: StorageOptions<T>): T {
  const cached = cache.get(key);
  if (cached) return cached.value as T;

  let next = initial;
  let dirty = false;

  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) {
      dirty = true;
    } else {
      const parsed: unknown = JSON.parse(raw);
      if (options?.validate && !options.validate(parsed)) {
        dirty = true;
      } else {
        const typed = parsed as T;
        const revived = options?.revive ? options.revive(typed) : typed;
        next = revived;
        dirty = revived !== parsed;
      }
    }
  } catch {
    dirty = true;
  }

  cache.set(key, { value: next });

  if (dirty) {
    const snapshot = next;
    queueMicrotask(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(snapshot));
      } catch {
        // Private mode or a full quota should not break the screen.
      }
    });
  }

  return next;
}

export function useLocalStorage<T>(key: string, initialValue: T, options?: StorageOptions<T>) {
  const getSnapshot = useCallback(
    () => loadValue(key, initialValue, options),
    [initialValue, key, options],
  );
  const getServerSnapshot = useCallback(() => initialValue, [initialValue]);

  const value = useSyncExternalStore(
    (listener) => subscribeKey(key, listener),
    getSnapshot,
    getServerSnapshot,
  );

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = loadValue(key, initialValue, options);
      const resolved = typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
      if (Object.is(resolved, prev)) return;
      cache.set(key, { value: resolved });
      try {
        window.localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // Keep the in-memory value even if persistence fails.
      }
      emit(key);
    },
    [initialValue, key, options],
  );

  return { value, setValue };
}

function subscribeHydration() {
  return () => {};
}

export function useHydrated() {
  return useSyncExternalStore(subscribeHydration, () => true, () => false);
}
