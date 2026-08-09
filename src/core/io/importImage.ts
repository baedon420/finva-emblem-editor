export interface LoadedImage {
  element: HTMLImageElement;
  width: number;
  height: number;
  fileName: string;
}

export const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;

/** Message shown for files that decode to nothing usable. */
export const CORRUPT_IMAGE_MESSAGE =
  'That image could not be read. The file may be damaged — try re-saving it as a PNG.';

/**
 * Pre-decode validation. Returns a user-facing error message, or null when
 * the file looks importable. Pure and structural so it is testable without
 * DOM File objects.
 */
export function validateImageFile(file: { name: string; type: string; size: number }): string | null {
  if (file.size === 0) {
    return 'That file is empty, so there is no image to load.';
  }
  if (!(SUPPORTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'That file type is not supported. Use a PNG, JPEG, GIF, or WebP image.';
  }
  return null;
}

/**
 * Decodes an image file. Rejects with a user-facing message (never a
 * technical one) for unsupported types, empty files, and decode failures.
 */
export function loadImageFromFile(file: File): Promise<LoadedImage> {
  const validationError = validateImageFile(file);
  if (validationError) {
    return Promise.reject(new Error(validationError));
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      // A "successful" decode with no pixels is still unusable.
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        reject(new Error(CORRUPT_IMAGE_MESSAGE));
        return;
      }
      resolve({
        element: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        fileName: file.name,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(CORRUPT_IMAGE_MESSAGE));
    };
    img.src = url;
  });
}
