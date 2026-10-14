import { expect, test } from "bun:test";
import { liveRoundLabel } from "./rounds";

test("liveRoundLabel: should describe ready vs live", () => {
  const r = { sellerHandle: "amit", buyerHandle: "riya" };
  expect(liveRoundLabel({ ...r, status: "live" })).toBe("@amit vs @riya · live");
  expect(liveRoundLabel({ ...r, status: "ready" })).toBe("@amit vs @riya · starting soon");
});
