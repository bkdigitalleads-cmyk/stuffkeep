/**
 * Photo storage: images are resized (privacy-friendly EXIF strip via
 * re-encode) and copied into the app's documents/photos directory.
 * The database stores only filenames, never absolute paths, because the
 * app sandbox path can change between app updates.
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as LegacyFS from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const PHOTOS_DIR = 'photos';
const MAX_DIMENSION = 1600;

function photosDir(): Directory {
  const dir = new Directory(Paths.document, PHOTOS_DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

let counter = 0;

/**
 * Ingest a picked/captured image: resize to <=1600px, re-encode JPEG,
 * store under documents/photos. Returns the stored filename.
 */
export async function storePhoto(sourceUri: string): Promise<string> {
  const context = ImageManipulator.manipulate(sourceUri);
  const rendered = await context.resize({ width: MAX_DIMENSION }).renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
  const name = `p${Date.now()}_${counter++}.jpg`;
  const dest = new File(photosDir(), name);
  const src = new File(saved.uri);
  src.copy(dest);
  try {
    src.delete();
  } catch {
    // cache cleanup is best-effort
  }
  return name;
}

/** Absolute uri for a stored filename (for <Image source>). */
export function photoUri(filename: string): string {
  return new File(photosDir(), filename).uri;
}

export function deletePhotoFile(filename: string): void {
  try {
    const f = new File(photosDir(), filename);
    if (f.exists) f.delete();
  } catch {
    // missing file is fine
  }
}

export function deletePhotoFiles(filenames: string[]): void {
  for (const f of filenames) deletePhotoFile(f);
}

/**
 * Small base64 JPEG thumbnail for embedding in the PDF report.
 * Returns null if the photo can't be read (report proceeds without it).
 */
export interface ThumbResult {
  b64: string | null;
  /** Compact diagnostic trail — which methods ran and how they failed. */
  diag: string;
}

/**
 * Base64 JPEG for embedding in the PDF report. Tries three methods in order:
 * 1) 240px re-encode via expo-image-manipulator (small file, preferred)
 * 2) direct read of the stored JPEG via the new File API
 * 3) direct read via the legacy FileSystem API
 * The stored photo is already <=1600px re-encoded at ingest, so 2/3 are
 * correct, just heavier. Returns a diagnostic trail either way.
 */
export async function photoThumbBase64Diag(filename: string): Promise<ThumbResult> {
  const steps: string[] = [];
  const uri = photoUri(filename);

  // Method 1: manipulator re-encode
  try {
    const context = ImageManipulator.manipulate(uri);
    const rendered = await context.resize({ width: 240 }).renderAsync();
    const saved = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: 0.55,
      base64: true,
    });
    if (saved.base64 && saved.base64.length > 0) {
      return { b64: saved.base64, diag: 'm:ok' };
    }
    steps.push('m:empty');
  } catch (e: any) {
    steps.push('m:' + String(e?.message ?? e).slice(0, 80));
  }

  // Method 2: new File API direct read
  try {
    const f = new File(photosDir(), filename);
    if (!f.exists) {
      steps.push('f:missing');
    } else {
      const b64 = await f.base64();
      if (b64 && b64.length > 0) {
        return { b64, diag: steps.join('|') + '|f:ok(' + b64.length + ')' };
      }
      steps.push('f:empty');
    }
  } catch (e: any) {
    steps.push('f:' + String(e?.message ?? e).slice(0, 80));
  }

  // Method 3: legacy FileSystem API
  try {
    const b64 = await LegacyFS.readAsStringAsync(uri, {
      encoding: LegacyFS.EncodingType.Base64,
    });
    if (b64 && b64.length > 0) {
      return { b64, diag: steps.join('|') + '|l:ok(' + b64.length + ')' };
    }
    steps.push('l:empty');
  } catch (e: any) {
    steps.push('l:' + String(e?.message ?? e).slice(0, 80));
  }

  return { b64: null, diag: steps.join('|') };
}

/** Back-compat wrapper. */
export async function photoThumbBase64(filename: string): Promise<string | null> {
  return (await photoThumbBase64Diag(filename)).b64;
}
