import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { clearPin, getStoredPinHash, setPin, verifyPin } from "@/lib/lock";
import { showError } from "@/utils/toast";

interface LockCtx {
  pinEnabled: boolean;
  locked: boolean;
  enablePin: (pin: string) => void;
  changePin: (pin: string) => void;
  disablePin: () => void;
  unlock: (pin: string) => Promise<boolean>;
  lockNow: () => void;
}

const Ctx = createContext<LockCtx | null>(null);

const IDLE_LOCK_MS = 5 * 60 * 1000;

export function LockProvider({ children }: { children: React.ReactNode }) {
  const [pinEnabled, setPinEnabled] = useState<boolean>(
    () => !!getStoredPinHash(),
  );
  const [locked, setLocked] = useState<boolean>(() => !!getStoredPinHash());
  const idleRef = useRef<number | undefined>(undefined);

  const armIdleTimer = useCallback(() => {
    if (!getStoredPinHash()) return;
    window.clearTimeout(idleRef.current);
    idleRef.current = window.setTimeout(() => setLocked(true), IDLE_LOCK_MS);
  }, []);

  useEffect(() => {
    if (!pinEnabled) {
      window.clearTimeout(idleRef.current);
      return;
    }
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    const onActivity = () => armIdleTimer();
    events.forEach((e) =>
      window.addEventListener(e, onActivity, { passive: true }),
    );
    armIdleTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      window.clearTimeout(idleRef.current);
    };
  }, [pinEnabled, armIdleTimer]);

  const value: LockCtx = {
    pinEnabled,
    locked,

    enablePin: (pin) => {
      try {
        setPin(pin);
        setPinEnabled(true);
        armIdleTimer();
      } catch {
        showError("App lock isn't available in this browser context.");
      }
    },

    changePin: (pin) => {
      try {
        setPin(pin);
      } catch {
        showError("Could not update the PIN.");
      }
    },

    disablePin: () => {
      clearPin();
      setPinEnabled(false);
      setLocked(false);
      window.clearTimeout(idleRef.current);
    },

    unlock: async (pin) => {
      const ok = await verifyPin(pin);
      if (ok) {
        setLocked(false);
        armIdleTimer();
      }
      return ok;
    },

    lockNow: () => {
      if (getStoredPinHash()) setLocked(true);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLock() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLock must be used inside LockProvider");
  return ctx;
}