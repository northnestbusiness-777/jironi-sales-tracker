import { useRef, useState } from "react";
import {
  Check,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useApp } from "@/store/AppContext";
import { useLock } from "@/store/LockContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CategorySide } from "@/types";
import { download, isValidBackup } from "@/lib/storage";
import { showSuccess, showError } from "@/utils/toast";

export default function Settings() {
  const {
    state,
    apiKey,
    setApiKey,
    addProperty,
    renameProperty,
    addCategory,
    updateCategory,
    deleteCategory,
    resetAll,
    importState,
  } = useApp();
  const { pinEnabled, lockNow, enablePin, changePin, disablePin } = useLock();
  const importRef = useRef<HTMLInputElement>(null);

  const [keyDraft, setKeyDraft] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [newProp, setNewProp] = useState("");
  const [dictPid, setDictPid] = useState(state.properties[0]?.id ?? "");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editKeywords, setEditKeywords] = useState("");
  const [newCat, setNewCat] = useState({ name: "", side: "expense" as CategorySide, keywords: "" });
  const [pinMode, setPinMode] = useState<"off" | "set" | "change">("off");
  const [pinDraft, setPinDraft] = useState("");

  const dictCats = state.categories.filter((c) => c.propertyId === dictPid);

  const saveKey = () => {
    setApiKey(keyDraft);
    showSuccess(
      keyDraft.trim()
        ? "API key saved for this session (cleared when the tab closes)."
        : "API key cleared.",
    );
  };

  const commitPin = () => {
    const pin = pinDraft.trim();
    if (pin.length < 4) {
      showError("Use at least 4 characters for the PIN.");
      return;
    }
    if (pinMode === "set") enablePin(pin);
    else changePin(pin);
    setPinMode("off");
    setPinDraft("");
    showSuccess(pinMode === "set" ? "App lock enabled." : "PIN updated.");
  };

  const startEdit = (c: { id: string; name: string; keywords: string[] }) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditKeywords(c.keywords.join(", "));
  };

  const commitEdit = (c: import("@/types").Category) => {
    updateCategory({
      ...c,
      name: editName.trim() || c.name,
      keywords: editKeywords.split(",").map((k) => k.trim()).filter(Boolean),
    });
    setEditingId(null);
    showSuccess("Category updated.");
  };

  const submitNewCat = () => {
    if (!newCat.name.trim()) {
      showError("Give the category a name.");
      return;
    }
    addCategory({
      propertyId: dictPid,
      name: newCat.name.trim(),
      side: newCat.side,
      keywords: newCat.keywords.split(",").map((k) => k.trim()).filter(Boolean),
    });
    setNewCat({ name: "", side: newCat.side, keywords: "" });
    showSuccess("Category added.");
  };

  const onImport = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isValidBackup(parsed)) throw new Error("bad shape");
      // Safety net: snapshot current data first so an import is reversible.
      download(
        `ledger-backup-before-import-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(state, null, 2),
        "application/json",
      );
      importState(parsed);
      setDictPid(parsed.properties[0]?.id ?? "");
      showSuccess("Backup restored — your API key was left unchanged.");
    } catch {
      showError("That file doesn't look like a valid Ledger backup.");
    }
  };

  const CatItem = ({ c }: { c: import("@/types").Category }) =>
    editingId === c.id ? (
      <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
        <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 rounded-lg text-sm" />
        <Input
          value={editKeywords}
          onChange={(e) => setEditKeywords(e.target.value)}
          placeholder="keyword, another keyword…"
          className="h-8 rounded-lg text-xs"
        />
        <div className="flex gap-2">
          <Button size="sm" className="h-7 rounded-lg px-3" onClick={() => commitEdit(c)}>
            <Check size={13} /> Save
          </Button>
          <Button size="sm" variant="ghost" className="h-7 rounded-lg px-3" onClick={() => setEditingId(null)}>
            <X size={13} /> Cancel
          </Button>
        </div>
      </div>
    ) : (
      <div className="group flex items-center gap-2 rounded-xl border bg-card px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{c.name}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {c.keywords.slice(0, 5).map((k) => (
              <Badge key={k} variant="secondary" className="rounded-full px-2 py-0 text-[10px]">
                {k}
              </Badge>
            ))}
            {c.keywords.length > 5 && (
              <span className="text-[10px] text-muted-foreground">+{c.keywords.length - 5}</span>
            )}
            {c.excludeFromRevenue && (
              <Badge className="rounded-full bg-sky-50 px-2 py-0 text-[10px] text-sky-800 hover:bg-sky-50">
                non-revenue
              </Badge>
            )}
          </div>
        </div>
        <button onClick={() => startEdit(c)} className="text-muted-foreground hover:text-foreground" aria-label="Edit">
          <Pencil size={14} />
        </button>
        <button
          onClick={() => {
            const ok = deleteCategory(c.id);
            if (!ok) showError("This category is used by saved entries and can't be deleted.");
            else showSuccess("Category deleted.");
          }}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your records stay in this browser — turn on the app lock below on shared devices.
        </p>
      </div>

      {/* API key */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <KeyRound size={16} className="text-primary" /> Vision API key (photo extraction)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? "text" : "password"}
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                placeholder="Paste your Gemini API key…"
                className="rounded-xl pr-10"
              />
              <button
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Toggle visibility"
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <Button className="rounded-xl" onClick={saveKey}>Save</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Free keys are available at{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline"
            >
              aistudio.google.com/apikey
            </a>
            . The key is kept for this browsing session only (cleared when you close the
            tab), is sent to Google solely inside a request header when extracting
            photos, and is never included in backups.
          </p>
        </CardContent>
      </Card>

      {/* App lock */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <LockKeyhole size={16} className="text-primary" /> App lock
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Require a PIN before your books can be viewed on this device, with auto-lock
            after 5 minutes of inactivity. Recommended for shared front-desk computers.
          </p>
          {pinEnabled ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="rounded-xl" onClick={lockNow}>
                <LockKeyhole size={15} /> Lock now
              </Button>
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setPinMode(pinMode === "change" ? "off" : "change");
                  setPinDraft("");
                }}
              >
                Change PIN
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="rounded-xl border-red-200 text-destructive hover:bg-red-50 hover:text-destructive"
                  >
                    Turn off
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-display">
                      Turn off app lock?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Anyone opening this site on this device will see your financial
                      records straight away.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => {
                        disablePin();
                        showSuccess("App lock turned off.");
                      }}
                    >
                      Turn off
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setPinMode("set");
                setPinDraft("");
              }}
            >
              <LockKeyhole size={15} /> Enable PIN lock
            </Button>
          )}
          {(pinMode === "set" || pinMode === "change") && (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="password"
                inputMode="numeric"
                autoFocus
                value={pinDraft}
                onChange={(e) => setPinDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && commitPin()}
                placeholder="New PIN (min 4 characters)"
                className="tabular max-w-xs rounded-xl"
              />
              <Button className="rounded-xl" onClick={commitPin}>
                Save PIN
              </Button>
              <Button
                variant="ghost"
                className="rounded-xl"
                onClick={() => {
                  setPinMode("off");
                  setPinDraft("");
                }}
              >
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Properties */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base">Properties</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {state.properties.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <Input
                defaultValue={p.name}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== p.name) {
                    renameProperty(p.id, e.target.value);
                    showSuccess("Property renamed.");
                  }
                }}
                className="h-9 rounded-xl"
              />
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={newProp}
              onChange={(e) => setNewProp(e.target.value)}
              placeholder="Add a new property…"
              className="h-9 rounded-xl"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newProp.trim()) {
                  addProperty(newProp);
                  setNewProp("");
                  showSuccess("Property added with a starter category dictionary.");
                }
              }}
            />
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                if (!newProp.trim()) return;
                addProperty(newProp);
                setNewProp("");
                showSuccess("Property added with a starter category dictionary.");
              }}
            >
              <Plus size={15} /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Category dictionaries */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base">Category dictionary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <select
            value={dictPid}
            onChange={(e) => setDictPid(e.target.value)}
            className="h-9 rounded-xl border border-input bg-card px-3 text-sm font-medium"
          >
            {state.properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Keywords are matched against line-item descriptions (first-listed rules win
            ties). Edits apply to future extractions immediately.
          </p>

          {(["income", "expense"] as CategorySide[]).map((side) => (
            <div key={side}>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {side === "income" ? "Income categories" : "Expense categories"}
              </p>
              <div className="space-y-2">
                {dictCats
                  .filter((c) => c.side === side)
                  .map((c) => <CatItem key={c.id} c={c} />)}
              </div>
            </div>
          ))}

          <div className="rounded-xl border border-dashed p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Add category
            </p>
            <div className="grid gap-2 sm:grid-cols-[1fr_120px_1fr_auto]">
              <Input
                value={newCat.name}
                onChange={(e) => setNewCat((n) => ({ ...n, name: e.target.value }))}
                placeholder="Name"
                className="h-9 rounded-xl"
              />
              <select
                value={newCat.side}
                onChange={(e) => setNewCat((n) => ({ ...n, side: e.target.value as CategorySide }))}
                className="h-9 rounded-xl border border-input bg-card px-2 text-sm"
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
              <Input
                value={newCat.keywords}
                onChange={(e) => setNewCat((n) => ({ ...n, keywords: e.target.value }))}
                placeholder="keywords, comma separated"
                className="h-9 rounded-xl"
              />
              <Button className="rounded-xl" onClick={submitNewCat}>
                <Plus size={15} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base">Your data</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              // The API key lives in sessionStorage only, so it is never part of
              // a backup file — safe to share or move between devices.
              download("ledger-backup.json", JSON.stringify(state, null, 2), "application/json");
              showSuccess("Backup downloaded (without your API key).");
            }}
          >
            <Download size={15} /> Export backup
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={() => importRef.current?.click()}>
            <Upload size={15} /> Import backup
          </Button>
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = "";
            }}
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="rounded-xl border-red-200 text-destructive hover:bg-red-50 hover:text-destructive">
                <RotateCcw size={15} /> Reset all data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display">Reset everything?</AlertDialogTitle>
                <AlertDialogDescription>
                  All saved reports, entries and category edits will be permanently
                  deleted from this browser. Export a backup first if you might need it.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    resetAll();
                    showSuccess("All data reset.");
                  }}
                >
                  Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}