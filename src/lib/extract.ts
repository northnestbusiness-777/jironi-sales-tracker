import { PaymentMode } from "@/types";

const MODEL = "gemini-2.0-flash";
// The key travels in the x-goog-api-key header (see extractDSR) — never in the
// URL, where proxies and logging tools would capture it.
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export interface RawAmounts {
  btc: number;
  room_posting: number;
  cash: number;
  hdfc_upi: number;
  hdfc_card: number;
  hdfc_acc: number;
  sbi_upi: number;
  sbi_card: number;
  pnb_upi: number;
  pnb_card: number;
  credit_purchase: number;
  md_sir: number;
}

export interface RawRow {
  side: "credit" | "debit";
  description: string;
  legible: boolean;
  amounts: RawAmounts;
}

export interface ExtractionResult {
  rows: RawRow[];
  cashInHand: number;
  printedCreditTotal: number;
  printedDebitTotal: number;
}

export const AMOUNT_KEY_TO_MODE: Record<keyof RawAmounts, PaymentMode> = {
  btc: "BTC",
  room_posting: "Room Posting",
  cash: "Cash",
  hdfc_upi: "HDFC UPI",
  hdfc_card: "HDFC Card",
  hdfc_acc: "HDFC A/C",
  sbi_upi: "SBI UPI",
  sbi_card: "SBI Card",
  pnb_upi: "PNB UPI",
  pnb_card: "PNB Card",
  credit_purchase: "Credit Purchase",
  md_sir: "MD Sir A/C",
};

const PROMPT = `You are an expert at reading photographed Indian hotel Daily Sale Reports (DSR) / daily cash books.

The page is a two-sided ledger table:
LEFT SIDE = "Amount Credit" (money received). Columns: Sl.No, Particular, BTC, Room Posting, then bank columns: Cash, HDFC UPI, HDFC Card, SBI UPI, SBI Card, PNB UPI, PNB Card.
RIGHT SIDE = "Amount Debit" (money paid out). Columns: Sl.No, Particular, then: Cash, HDFC UPI, HDFC Card, HDFC ACC, SBI UPI, SBI Card, Credit Purchases, MD Sir A/C.
Bottom-left usually has a mode-of-payment summary and a "Cash in Hand" figure.

Return ONLY valid JSON (no markdown fences) shaped exactly:
{
  "cash_in_hand": <number>,
  "printed_credit_total": <number>,
  "printed_debit_total": <number>,
  "rows": [
    {
      "side": "credit" or "debit",
      "description": "<Particular text verbatim>",
      "legible": true or false,
      "amounts": {"btc":0,"room_posting":0,"cash":0,"hdfc_upi":0,"hdfc_card":0,"hdfc_acc":0,"sbi_upi":0,"sbi_card":0,"pnb_upi":0,"pnb_card":0,"credit_purchase":0,"md_sir":0}
    }
  ]
}

Rules:
- One object per line-item row. NEVER invent rows.
- Skip Sl.No-only rows, TOTAL / GRAND TOTAL rows and the summary block; instead put the sheet's own grand totals into printed_credit_total and printed_debit_total (0 if unreadable).
- Put each amount under the correct settlement-mode key; use 0 for empty cells.
- Copy "description" exactly as written, preserving abbreviations like C/O, S/A, (GO MMT), bill numbers in brackets.
- If handwriting or blur makes a value uncertain, still give your best guess and set "legible": false for that row.`;

const num = (v: unknown): number =>
  typeof v === "number" && isFinite(v) ? v : 0;

/** Downscale a photo so extraction stays fast and reliable. Returns a JPEG data URL. */
export async function resizeImage(file: File, maxDim = 1600): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read the image file."));
    r.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode the image."));
    img.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
  const w = Math.max(1, Math.round(image.width * scale));
  const h = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(image, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export async function extractDSR(
  apiKey: string,
  imageDataUrl: string,
): Promise<ExtractionResult> {
  const [head, b64] = imageDataUrl.split(",");
  const mime = head?.match(/data:(.*);base64/)?.[1] ?? "image/jpeg";

  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mime, data: b64 } },
        ],
      },
    ],
    generationConfig: { temperature: 0, response_mime_type: "application/json" },
  };

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let msg = `Vision request failed (${res.status}).`;
    try {
      const j = await res.json();
      if (j?.error?.message) msg = j.error.message;
    } catch {
      /* keep default */
    }
    if (res.status === 400 || res.status === 403)
      msg = "API key rejected — check it in Settings. (" + msg + ")";
    throw new Error(msg);
  }

  const j = await res.json();
  const text: string = (j.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("");

  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```\s*$/, "")
    .trim();

  let parsed: {
    cash_in_hand?: number;
    printed_credit_total?: number;
    printed_debit_total?: number;
    rows?: Array<{
      side?: string;
      description?: string;
      legible?: boolean;
      amounts?: Partial<Record<keyof RawAmounts, number>>;
    }>;
  };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Could not parse the AI response — please retry.");
  }

  const rows: RawRow[] = (parsed.rows ?? []).map((r) => ({
    side: r.side === "debit" ? "debit" : "credit",
    description: String(r.description ?? "").trim(),
    legible: r.legible !== false,
    amounts: {
      btc: num(r.amounts?.btc),
      room_posting: num(r.amounts?.room_posting),
      cash: num(r.amounts?.cash),
      hdfc_upi: num(r.amounts?.hdfc_upi),
      hdfc_card: num(r.amounts?.hdfc_card),
      hdfc_acc: num(r.amounts?.hdfc_acc),
      sbi_upi: num(r.amounts?.sbi_upi),
      sbi_card: num(r.amounts?.sbi_card),
      pnb_upi: num(r.amounts?.pnb_upi),
      pnb_card: num(r.amounts?.pnb_card),
      credit_purchase: num(r.amounts?.credit_purchase),
      md_sir: num(r.amounts?.md_sir),
    },
  }));

  return {
    rows,
    cashInHand: num(parsed.cash_in_hand),
    printedCreditTotal: num(parsed.printed_credit_total),
    printedDebitTotal: num(parsed.printed_debit_total),
  };
}