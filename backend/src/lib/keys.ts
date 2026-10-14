// Key builders for the single table; layout in docs/system_specs/data_model.md.
export const slotPk = (slotId: string) => `SLOT#${slotId}`;
export const roundPk = (roundId: string) => `ROUND#${roundId}`;
export const STATS_SK = "STATS";
