// Pure text helpers for generated messages (no server imports — safe to test in isolation).

const PLACEHOLDER_LINE = /\[[^\]\n]*(name|signature)[^\]\n]*\]/i
const DANGLING_CLOSING = /^(?:[—–-]+\s*)?(?:best|thanks|thank you|cheers|regards|warmly|sincerely|all the best|talk soon)[,!.]?\s*$/i

/**
 * Remove placeholder sign-offs such as "— [Your name]" or "Best,\n[Name]" that the model
 * sometimes appends when it does not know who is writing. If removing the placeholder leaves a
 * dangling closing line ("Best,") at the end, that line is dropped too.
 */
export function stripSignaturePlaceholders(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const kept = lines
    .filter(line => !PLACEHOLDER_LINE.test(line))
    // A line like "— Jordan" is fine; only inline placeholders are scrubbed
    .map(line => line.replace(/\s*[—–-]\s*\[[^\]\n]*(name|signature)[^\]\n]*\]\s*$/i, ''))
  while (kept.length && (kept[kept.length - 1].trim() === '' || DANGLING_CLOSING.test(kept[kept.length - 1].trim()))) {
    kept.pop()
  }
  return kept.join('\n').trim()
}
