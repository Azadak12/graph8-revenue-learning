/** Graph8Provider: the single seam between business logic and Graph8.
 * Ported from backend/app/services/graph8/base.py. */
import type { G8Deal, G8DealBundle } from "./schemas";

export interface Graph8Provider {
  mode: string;
  getDealBundle(graph8DealId: string): Promise<G8DealBundle>;
  listClosedDeals(): Promise<G8Deal[]>;
  listActiveDeals(): Promise<G8Deal[]>;
  /** Lists deal ids with their outcome only (no per-deal lookups). */
  listDealRefs?(): Promise<Array<{ id: string; outcome: string }>>;
  /** Records the outcome Graph8 listed a deal under, for later bundle fetches. */
  rememberOutcome?(graph8DealId: string, outcome: string): void;
  createTask(args: {
    graph8DealId: string;
    title: string;
    description: string;
    assigneeHint?: string | null;
  }): Promise<string>;
  createNote(args: { graph8DealId: string; body: string }): Promise<string | null>;
}
