import { useState, type FormEvent } from "react";
import { Landmark, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useLock } from "@/store/LockContext";

export default function LockScreen() {
  const { unlock } = useLock();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!pin || busy) return;
    setBusy(true);
    const ok = await unlock(pin);
    setBusy(false);
    if (!ok) {
      setError("Incorrect PIN — try again.");
      setPin("");
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <Card className="w-full max-w-sm rounded-2xl shadow-sm">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Landmark size={22} />
          </span>
          <div>
            <p className="font-display text-lg font-semibold">Ledger is locked</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your PIN to view your books.
            </p>
          </div>
          <form onSubmit={submit} className="w-full space-y-3">
            <Input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError("");
              }}
              placeholder="PIN"
              className="tabular rounded-xl text-center tracking-[0.4em]"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              className="w-full rounded-xl"
              disabled={busy || !pin}
            >
              <LockKeyhole size={15} /> Unlock
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}