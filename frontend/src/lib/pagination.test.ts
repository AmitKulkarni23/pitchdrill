import { expect, test } from "bun:test";
import { appendPage } from "./pagination";

test("appendPage: should append and de-duplicate by id", () => {
  const a = [{ id: "1" }, { id: "2" }];
  expect(appendPage(a, [{ id: "2" }, { id: "3" }], (x) => x.id)).toEqual([{ id: "1" }, { id: "2" }, { id: "3" }]);
  expect(appendPage([], [{ id: "1" }], (x) => x.id)).toEqual([{ id: "1" }]);
  expect(appendPage(a, [], (x) => x.id)).toEqual(a);
});
