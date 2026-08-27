import { useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Camera,
  KeyRound,
  Loader2,
  PencilLine,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useApp } from "@/store/AppContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AMOUNT_KEY_TO_MODE, extractDSR, RawRow, resizeImage } from "@/lib/extract";
import { categorize } from "@/lib/categorize";
import { todayISO, uid } from "@/lib/utils";
import { showError, showSuccess } from "@/utils/toast";

const STEPS = ["Details", "Photo", "Review"];

export default function Upload() {
  const { state, apiKey, createDraft } = useApp();
  const nav = useNavigate();
  const [search] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  const [pid, setPid] = useState(
    () => search.get("property") ?? state.properties[0]?.id ?? "",
  );
  const [date, setDate] = useState(() => search.get("date") ?? todayISO());
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [pending, setPending] = useState<{ files: File[]; manual: boolean } | null>(null);

  const property = state.properties.find((p) => p.id === pid) ?? state.properties[0];
  const existingSaved = state.reports.find(
    (r) => r.propertyId === pid && r.date === date && r.status === "saved",
  );

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const imgs = Array.from(list).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...imgs].slice(0, 4));
  };

  const buildEntries = (rows: RawRow[]) => {
    const cats = state.categories.filter((c) => c.propertyId === pid);
    const corrections = state.corrections[pid] ?? {};
    const out = [];
    for (const row of rows) {
      const pairs = (
        Object.entries(row.amounts) as [keyof typeof AMOUNT_KEY_TO_MODE, number][]
      ).filter(([, v]) => v > 0);
      const usePairs = pairs.length ? pairs : ([["cash", 0]] as [keyof typeof AMOUNT_KEY_TO_MODE, number][]);
      for (const [key, value] of usePairs) {
        const cat = categorize(row.description, cats, corrections);
        const rowConf = row.legible ? 0.85 : 0.3;
        const confidence = Math.min(rowConf, cat.confidence);
        out.push({
          id: uid("ent"),
          side: row.side,
          description: row.description,
          categoryId: cat.categoryId,
          subTag: cat.subTag,
          amount: value,
          paymentMode: AMOUNT_KEY_TO_MODE[key],
          confidence,
          flagged: !row.legible || cat.flagged || confidence < 0.7,
        });
      }
    }
    return out;
  };

  const runExtract = async (list: File[]) => {
    if (!apiKey) {
      showError("Add your Gemini API key in Settings first.");
      return;
    }
    setBusy(true);
    try {
      let allRows: RawRow[] = [];
      let cash = 0;
      let pc = 0;
      let pd = 0;
      for (let i = 0; i < list.length; i++) {
        setProgress(
          list.length > 1 ? `Reading photo ${i + 1} of ${list.length}…` : "Reading the report…",
        );
        const dataUrl = await resizeImage(list[i]);
        const r = await extractDSR(apiKey, dataUrl);
        allRows = allRows.concat(r.rows);
        if (r.cashInHand) cash = r.cashInHand;
        if (r.printedCreditTotal) pc = r.printedCreditTotal;
        if (r.printedDebitTotal) pd = r.printedDebitTotal;
      }
      if (!allRows.length)
        throw new Error("No rows detected — try a clearer, well-lit, straight-on photo.");
      const entries = buildEntries(allRows);
      const id = createDraft({
        propertyId: pid,
        date,
        cashInHand: cash,
        printedCreditTotal: pc || undefined,
        printedDebitTotal: pd || undefined,
        entries,
      });
      showSuccess(`Extracted ${entries.length} line items — please review before saving.`);
      nav(`/review/${id}`);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Extraction failed.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const startManual = () => {
    const id = createDraft({ propertyId: pid, date, cashInHand: 0, entries: [] });
    showSuccess("Blank report created — add line items in the review screen.");
    nav(`/review/${id}`);
  };

  const onExtractClick = () => {
    if (!files.length) {
      showError("Choose or photograph the DSR first.");
      fileRef.current?.click();
      return;
    }
    if (existingSaved) setPending({ files, manual: false });
    else runExtract(files);
  };

  const onManualClick = () => {
    if (existingSaved) setPending({ files: [], manual: true });
    else startManual();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div>
        <h1 className="font-display text-2xl font-semibold">New daily report</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Photograph the nightly cash book — every line is extracted, categorized and
          queued for your review.
        </p>
      </div>

      {/* Stepper */}
      <ol className="flex items-center gap-2 text-xs font-medium">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={
                "grid size-6 place-items-center rounded-full " +
                (i === 0
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground")
              }
            >
              {i + 1}
            </span>
            <span className={i === 0 ? "text-foreground" : "text-muted-foreground"}>{s}</span>
            {i < STEPS.length - 1 && <span className="h-px w-6 bg-border sm:w-10" />}
          </li>
        ))}
      </ol>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Property
              </label>
              <select
                value={pid}
                onChange={(e) => setPid(e.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm font-medium"
              >
                {state.properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Report date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="tabular h-10 w-full rounded-xl border border-input bg-card px-3 text-sm font-medium"
              />
            </div>
          </div>

          {!apiKey && (
            <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center">
              <AlertTriangle size={18} className="shrink-0 text-amber-700" />
              <p className="flex-1 text-sm text-amber-900">
                Photo extraction needs a free Gemini API key. You can still enter the
                report manually.
              </p>
              <Button asChild size="sm" variant="outline" className="rounded-xl border-amber-400 bg-white">
                <Link to="/settings">
                  <KeyRound size={14} /> Add key
                </Link>
              </Button>
            </div>
          )}

          {/* Dropzone */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-input bg-secondary/40 px-6 py-10 text-center transition-colors hover:border-primary/50 hover:bg-secondary/70"
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Camera size={22} />
            </span>
            <span className="text-sm font-medium">
              Tap to photograph or choose the DSR image
            </span>
            <span className="text-xs text-muted-foreground">
              JPG or PNG · one photo per property per day · up to 4 pages
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {/* Third-party transmission disclosure */}
          <div className="flex gap-2.5 rounded-xl border border-sky-200 bg-sky-50 p-3.5">
            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-sky-700" />
            <p className="text-xs leading-relaxed text-sky-900">
              <span className="font-medium">Photos leave this device:</span> DSR images
              are sent to Google's Gemini API purely to read the figures off the page
              and are not stored by this app. For sensitive pages, use{" "}
              <span className="font-medium">Enter manually</span> instead, and crop out
              any guest or staff personal details before photographing.
            </p>
          </div>

          {files.length > 0 && (
            <ul className="space-y-1.5">
              {files.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm"
                >
                  <Sparkles size={14} className="text-primary" />
                  <span className="flex-1 truncate">{f.name}</span>
                  <button
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="flex-1 rounded-xl"
              onClick={onExtractClick}
              disabled={busy}
            >
              {busy ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> {progress || "Extracting…"}
                </>
              ) : (
                <>
                  <Sparkles size={15} /> Extract with AI
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={onManualClick}
              disabled={busy}
            >
              <PencilLine size={15} /> Enter manually
            </Button>
          </div>

          {existingSaved && (
            <p className="text-xs text-muted-foreground">
              A saved report already exists for{" "}
              <span className="font-medium">
                {property?.name} · {format(parseISO(date), "d MMM yyyy")}
              </span>{" "}
              — extracting again will ask you to confirm an overwrite.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Overwrite confirmation */}
      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Overwrite existing report?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {property?.name} already has a saved report for{" "}
              {format(parseISO(date), "d MMM yyyy")}. Continuing will replace its line
              items with the new ones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl"
              onClick={() => {
                if (pending?.manual) startManual();
                else if (pending) runExtract(pending.files);
                setPending(null);
              }}
            >
              Overwrite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}