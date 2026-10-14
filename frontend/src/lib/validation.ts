// Same rule as the backend (docs/system_specs/data_model.md → Limits and Validation).
export const HANDLE_RULE = /^[A-Za-z0-9_]{3,20}$/;
export const isValidHandle = (handle: string): boolean => HANDLE_RULE.test(handle);

const NICKNAME_RULE = /^[A-Za-z0-9 _.-]{2,20}$/;
/** Nicknames are trimmed, then 2–20 letters, numbers, spaces or `_-.` (same as the backend). */
export const isValidNickname = (nickname: string): boolean => NICKNAME_RULE.test(nickname.trim());

const inRange = (text: string, max: number) => text.trim().length >= 1 && text.trim().length <= max;
/** Comments are 1–500 characters after trimming. */
export const isValidComment = (text: string): boolean => inRange(text, 500);
/** Report reasons are 1–300 characters after trimming. */
export const isValidReason = (text: string): boolean => inRange(text, 300);
