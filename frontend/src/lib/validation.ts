// Same rule as the backend (docs/system_specs/data_model.md → Limits and Validation).
export const HANDLE_RULE = /^[A-Za-z0-9_]{3,20}$/;
export const isValidHandle = (handle: string): boolean => HANDLE_RULE.test(handle);
