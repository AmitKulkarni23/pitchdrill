export interface Tally {
  sold: number;
  notSold: number;
}

/** Counts only grow, so a lower total is an older snapshot (a slow poll arriving after a live event) and is ignored. */
export function tallyReducer(state: Tally, next: Tally): Tally {
  return next.sold + next.notSold >= state.sold + state.notSold ? next : state;
}

/** Whole-number percentages that stay 0/0 when nobody has voted. */
export function votePercent({ sold, notSold }: Tally): { sold: number; notSold: number } {
  const total = sold + notSold;
  if (total === 0) return { sold: 0, notSold: 0 };
  const s = Math.round((sold / total) * 100);
  return { sold: s, notSold: 100 - s };
}
