export type NodeType = 'root' | 'dealer' | 'agent' | 'hall';
export interface Permission {
  key: string;
  action: string;
  target_type: NodeType | '';
  section: string;
  name: string;
  applies_to: NodeType[];
  roles: string[];
  requires: string[];
  relation: 'self' | 'subtree' | 'descendant';
}
export interface Operation {operation: string; method: string; path: string}
export interface TicketBet {
  stake: number;
  outcome: string;
  ratio: number;
  payout: number;
}
export interface TicketIntake {
  round_ref: string;
  stage: number;
  stake: number;
  bets: Array<Pick<TicketBet, 'outcome' | 'ratio'>>;
  barcode: string;
  idempotency_key: string;
}
export interface Ticket {
  id: string;
  reference_code: string;
  round: string;
  round_number: number;
  game: string;
  currency: string;
  stake: number;
  bets: TicketBet[];
  payout: number;
  status: 'pending' | 'won' | 'lost' | 'paid_out' | 'expired' | 'void';
  hall_in: string;
  hall_out: string;
  cashier_in: string;
  cashier_out: string;
  accepted_at: number;
  paid_at: number;
  expires_at: number;
  max_win: number;
  rules_version: string;
  created_at: number;
  hall_in_name: string;
  hall_out_name: string;
  cashier_in_name: string;
  cashier_out_name: string;
}
export interface TicketIntakeResponse {ticket: Ticket; replayed: boolean}
export const contract: {
  name: string;
  version: string;
  permissions: Permission[];
  routes: Operation[];
  pocketbase: {collections: Record<string, {auth?: boolean; realtime?: boolean; queryFields?: string[]}>};
};
export const operations: Readonly<Record<string, Operation>>;
export const collections: typeof contract.pocketbase.collections;
export function path(operation: string, params?: Record<string, string>): string;
