export interface TagMatchResult {
  matches: boolean;
  version?: number;
}

/**
 * Match a tag against a pattern where `%` is the version-number wildcard.
 * `matchSubmissionTag('submission_v3', 'submission_v%')` → `{ matches: true, version: 3 }`
 */
export function matchSubmissionTag(tagName: string, pattern: string): TagMatchResult {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // `%` → `(\d+)` capture group for version extraction
  const regexStr = `^${escaped.replace(/%/g, '(\\d+)')}$`;

  const match = new RegExp(regexStr).exec(tagName);
  if (!match) {
    return { matches: false };
  }

  const versionStr = match[1];
  const version = versionStr !== undefined ? Number.parseInt(versionStr, 10) : undefined;

  return { matches: true, version };
}
