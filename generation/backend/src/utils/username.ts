const reserved = new Set(['admin', 'administrator', 'support', 'help', 'generation', 'official', 'moderator', 'security', 'system']);
const usernamePattern = /^[a-z0-9_]{6,20}$/;

export function normalizeUsername(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return usernamePattern.test(normalized) && !reserved.has(normalized) ? normalized : null;
}
export function normalizeUsernameSearch(value: string): string | null {
  const normalized = value.trim().replace(/^@/, '').toLowerCase();
  return /^[a-z0-9_]{1,20}$/.test(normalized) ? normalized : null;
}
