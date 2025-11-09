import { SHEETS_WEBAPP_URL, READ_TOKEN } from "./env";

type PostBody =
  | { action: "ping"; token: string }
  | { action: "list_trades"; token: string; account: string; from?: string; to?: string; limit?: number; }
  | { action: "append_trades"; token: string; account: string; trades: any[] };

export async function postToSheets(body: PostBody) {
  const res = await fetch(SHEETS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error || `Sheets WebApp error (${res.status})`);
  }
  return json;
}

export async function pingSheets() {
  return postToSheets({ action: "ping", token: READ_TOKEN });
}

export async function getTrades(account: string, opts?: { from?: string; to?: string; limit?: number }) {
  return postToSheets({ action: "list_trades", token: READ_TOKEN, account, ...opts });
}
