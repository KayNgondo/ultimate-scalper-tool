export type CashTxType = 'deposit' | 'withdrawal' | 'fee' | 'correction';

export interface WalletTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: CashTxType;
  currency: string;
  occurred_at: string;
  note: string | null;
  created_at: string;
}
