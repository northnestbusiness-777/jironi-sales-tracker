const LOCK_KEY = "ledger-dsr-lock";

async function hashPin(pin: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("WebCrypto unavailable");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`ledger-dsr:${pin}`),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Returns the stored PIN hash, or null when no lock is configured. */
export function getStoredPinHash(): string | null {
  try {
    return localStorage.getItem(LOCK_KEY);
  } catch {
    return null;
  }
}

export async function setPin(pin: string): Promise<void> {
  // Only the salted hash is ever persisted — never the PIN itself.
  localStorage.setItem(LOCK_KEY, await hashPin(pin));
}

export function clearPin(): void {
  try {
    localStorage.removeItem(LOCK_KEY);
  } catch {
    /* ignore */
  }
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = getStoredPinHash();
  if (!stored) return true;
  try {
    return (await hashPin(pin)) === stored;
  } catch {
    return false;
  }
}