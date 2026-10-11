const MAX_RAW_BYTES = 10 * 1024 * 1024; // 10 MB, before compression
const MAX_COMPRESSED_MB = 0.3; // ~300 KB
const MAX_DIMENSION = 1600;

export class ImageValidationError extends Error {}

export function validateImageFile(file: File): void {
  if (!file.type.startsWith("image/")) {
    throw new ImageValidationError("Please choose an image file.");
  }
  if (file.size > MAX_RAW_BYTES) {
    throw new ImageValidationError("Image is too large (max 10 MB).");
  }
}

// browser-image-compression pulls in a web worker + wasm-ish codecs, so it's
// only loaded once the user actually picks a file instead of on first paint.
export async function compressToWebp(file: File): Promise<File> {
  const { default: imageCompression } = await import("browser-image-compression");
  return imageCompression(file, {
    maxSizeMB: MAX_COMPRESSED_MB,
    maxWidthOrHeight: MAX_DIMENSION,
    useWebWorker: true,
    fileType: "image/webp",
  });
}
