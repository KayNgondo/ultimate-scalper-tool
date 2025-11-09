export const SHEETS_WEBAPP_URL = process.env.NEXT_PUBLIC_SHEETS_WEBAPP_URL!;
export const READ_TOKEN = process.env.NEXT_PUBLIC_SHEETS_READ_TOKEN!;
export const DEFAULT_UST_ACCOUNT = process.env.NEXT_PUBLIC_UST_ACCOUNT ?? "";
export const ALLOWED_ACCOUNTS =
  (process.env.NEXT_PUBLIC_UST_ALLOWED_ACCOUNTS ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
