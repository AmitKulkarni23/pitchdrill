import { beforeEach, expect, test } from "bun:test";
import { addTicket, getTickets, getVoterId } from "./storage";

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = memory();
});

test("getVoterId: should create once and return the same UUID", () => {
  const id = getVoterId();
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  expect(getVoterId()).toBe(id);
});

test("storage: given localStorage throws, should return defaults without throwing", () => {
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  expect(getTickets()).toEqual([]);
  expect(() => addTicket("t")).not.toThrow();
  expect(getVoterId()).toBe(getVoterId());
});

test("addTicket: should not duplicate tickets", () => {
  addTicket("a");
  addTicket("a");
  addTicket("b");
  expect(getTickets()).toEqual(["a", "b"]);
});

import { getRememberedVote, rememberVote } from "./storage";

test("rememberVote/getRememberedVote: should persist per round", () => {
  expect(getRememberedVote("r1")).toBeNull();
  rememberVote("r1", "sold");
  rememberVote("r2", "not_sold");
  expect(getRememberedVote("r1")).toBe("sold");
  expect(getRememberedVote("r2")).toBe("not_sold");
});
