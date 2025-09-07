export type Mt5Side = "buy" | "sell";

export interface Mt5WebhookPayload {
  api_key: string;      // uuid from public.api_keys
  deal_id: string | number;
  symbol: string;
  side: Mt5Side;
  volume: number;
  price: number;
  time: string;         // ISO8601
}