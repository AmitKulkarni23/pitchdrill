const apiUrl = process.env.NEXT_PUBLIC_API_URL;
if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL is not set (see CLAUDE.md → Commands → Frontend).");

export const API_URL = apiUrl.replace(/\/$/, "");
