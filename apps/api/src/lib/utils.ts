import { INVITE_CODE_LENGTH, INVITE_CODE_ALPHABET } from './constants.js';

/**
 * Generate a cryptographically secure invite code using rejection sampling
 * to eliminate modulo bias.
 */
export function generateInviteCode(): string {
  const alphabetLen = INVITE_CODE_ALPHABET.length;
  // Largest multiple of alphabetLen that fits in a byte (256)
  const maxValid = Math.floor(256 / alphabetLen) * alphabetLen;

  const result: string[] = [];
  while (result.length < INVITE_CODE_LENGTH) {
    const bytes = new Uint8Array(INVITE_CODE_LENGTH - result.length);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < maxValid && result.length < INVITE_CODE_LENGTH) {
        result.push(INVITE_CODE_ALPHABET[b % alphabetLen]);
      }
    }
  }
  return result.join('');
}
