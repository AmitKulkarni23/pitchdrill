import { expect, test } from "bun:test";
import { tallyReducer, votePercent } from "./votes";

test("tallyReducer: should apply tally events and ignore older polls", () => {
  const live = tallyReducer({ sold: 1, notSold: 1 }, { sold: 3, notSold: 1 });
  expect(live).toEqual({ sold: 3, notSold: 1 });
  expect(tallyReducer(live, { sold: 1, notSold: 1 })).toBe(live); // stale poll
  expect(tallyReducer(live, { sold: 3, notSold: 1 })).toEqual(live);
});

test("votePercent: should handle zero votes", () => {
  expect(votePercent({ sold: 0, notSold: 0 })).toEqual({ sold: 0, notSold: 0 });
  expect(votePercent({ sold: 1, notSold: 3 })).toEqual({ sold: 25, notSold: 75 });
  expect(votePercent({ sold: 1, notSold: 2 })).toEqual({ sold: 33, notSold: 67 });
});
