/**
 * Photo handling on the device.
 *
 * Photos are resized and re-encoded in the browser before they are stored, so
 * a proof or an avatar stays a few kilobytes instead of the several megabytes a
 * phone camera produces. Nothing is uploaded anywhere on the way.
 */

export type ResizeOptions = {
  /** Longest side of the result, in pixels. */
  max: number;
  /** Crops to a centred square — used for avatars. */
  square?: boolean;
  quality?: number;
};

async function load(file: File): Promise<{ img: HTMLImageElement; revoke: () => void }> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Image illisible'));
    el.src = url;
  });
  return { img, revoke: () => URL.revokeObjectURL(url) };
}

/** Returns a JPEG data URL, or an empty string when the file cannot be read. */
export async function resizeToDataUrl(file: File, options: ResizeOptions): Promise<string> {
  const { max, square = false, quality = 0.82 } = options;
  let handle: { img: HTMLImageElement; revoke: () => void } | null = null;

  try {
    handle = await load(file);
    const { img } = handle;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    if (square) {
      canvas.width = max;
      canvas.height = max;
      const side = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, max, max);
    } else {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }

    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return '';
  } finally {
    handle?.revoke();
  }
}

/** Rough byte size of a data URL, for the "photo trop lourde" guard. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return 0;
  return Math.round(((dataUrl.length - comma - 1) * 3) / 4);
}
