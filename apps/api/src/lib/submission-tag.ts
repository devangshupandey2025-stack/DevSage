// Default tag pattern (configurable per hackathon via settings)
const DEFAULT_TAG_PATTERN = 'submission-v*';

export function globToRegex(pattern: string): RegExp {
  let regex = '^';
  for (const char of pattern) {
    switch (char) {
      case '*': regex += '.*'; break;
      case '?': regex += '.'; break;
      case '.': regex += '\\.'; break;
      case '(': regex += '\\('; break;
      case ')': regex += '\\)'; break;
      case '[': regex += '\\['; break;
      case ']': regex += '\\]'; break;
      case '{': regex += '\\{'; break;
      case '}': regex += '\\}'; break;
      case '+': regex += '\\+'; break;
      case '^': regex += '\\^'; break;
      case '$': regex += '\\$'; break;
      case '|': regex += '\\|'; break;
      case '\\': regex += '\\\\'; break;
      default: regex += char;
    }
  }
  regex += '$';
  return new RegExp(regex);
}

export function matchesTagPattern(tagName: string, pattern?: string): boolean {
  const pat = pattern || DEFAULT_TAG_PATTERN;
  const regex = globToRegex(pat);
  return regex.test(tagName);
}
