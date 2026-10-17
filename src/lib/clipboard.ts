// src/lib/clipboard.ts

/**
 * `navigator.clipboard.writeText` rejects in insecure contexts or when
 * permission is denied, and the original call had no `.catch` — a silent
 * no-op with the button never reflecting failure. Fall back to the classic
 * hidden-textarea + execCommand technique so copying still works.
 */
export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (ok) resolve();
      else reject(new Error('Copy failed'));
    } catch (error) {
      document.body.removeChild(textarea);
      reject(error instanceof Error ? error : new Error('Copy failed'));
    }
  });
}

/**
 * The native share sheet on a phone (texting a link beats copying it and
 * switching apps), the clipboard everywhere else. Resolves to what happened
 * so the caller can say "Link copied" only when it was.
 */
export async function shareOrCopy(payload: {
  title: string;
  text: string;
  url: string;
}): Promise<'shared' | 'copied' | 'cancelled'> {
  if (navigator.share) {
    try {
      await navigator.share(payload);
      return 'shared';
    } catch {
      // Closing the share sheet rejects too; that is not a failure.
      return 'cancelled';
    }
  }
  await copyToClipboard(payload.url);
  return 'copied';
}
