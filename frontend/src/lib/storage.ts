// Every read/write is guarded: storage can be missing or throw (private mode, blocked site data).

const KEYS = { voterId: "pd.voterId", nickname: "pd.nickname", tickets: "pd.tickets" } as const;

function read(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Not persisted; the page still works for this visit.
  }
}

let memoryVoterId: string | undefined;

export function getVoterId(): string {
  const stored = read(KEYS.voterId);
  if (stored) return stored;
  const id = memoryVoterId ?? crypto.randomUUID();
  memoryVoterId = id;
  write(KEYS.voterId, id);
  return id;
}

export const getNickname = (): string | null => read(KEYS.nickname);
export const setNickname = (nickname: string): void => write(KEYS.nickname, nickname);

export function getTickets(): string[] {
  try {
    const parsed = JSON.parse(read(KEYS.tickets) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export function addTicket(ticket: string): void {
  const tickets = getTickets();
  if (!tickets.includes(ticket)) write(KEYS.tickets, JSON.stringify([...tickets, ticket]));
}
