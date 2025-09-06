export type DealPayload = {
  api_key: string;
  deal_id: number;
  order_id?: number | null;
  position_id?: number | null;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  price: number;
  profit?: number | null;
  commission?: number | null;
  swap?: number | null;
  comment?: string | null;
  magic?: number | null;
  account_id?: string | null;
  broker?: string | null;
  time: string;
};
