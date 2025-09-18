/**
 * SSR-safe localStorage shim.
 * Prevents "ReferenceError: localStorage is not defined" when Next.js
 * prerenders on the server. On the server we attach a minimal in-memory
 * implementation to globalThis.localStorage.
 */
export function ensureLocalStorageOnServer() {
  if (typeof window === "undefined" && !(globalThis as any).localStorage) {
    const store = new Map<string, string>();
    const shim: Storage = {
      length: 0,
      clear: () => { store.clear(); shim.length = 0; },
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      removeItem: (key: string) => {
        if (store.has(key)) {
          store.delete(key);
          shim.length = store.size;
        }
      },
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
        shim.length = store.size;
      }
    };
    (globalThis as any).localStorage = shim;
  }
}
