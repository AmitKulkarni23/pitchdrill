import { createHash, randomBytes } from "node:crypto";

export const newTicket = () => randomBytes(32).toString("base64url");
export const hashTicket = (ticket: string) => createHash("sha256").update(ticket).digest("hex");
