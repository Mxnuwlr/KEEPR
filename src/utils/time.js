/**
 * Parst prep_time — entweder JSON {"total":"...","active":"...","wait":"..."}
 * oder Legacy-Plaintext — und gibt die Anzeigezeit zurück.
 */
export function getDisplayTime(prepTime) {
  if (!prepTime) return null;
  try {
    const parsed = JSON.parse(prepTime);
    if (parsed && typeof parsed === 'object') return parsed.total || parsed.active || null;
  } catch {}
  return prepTime;
}
