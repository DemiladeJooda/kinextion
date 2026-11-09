/**
 * Your avatar, kept on your phone.
 *
 * The API makes images and forgets them. Everything finished lives in this
 * app's private folder: the first avatar, the latest, moods and activities.
 * Deleting removes all of it.
 */

import * as FileSystem from "expo-file-system/legacy";

const DIR = `${FileSystem.documentDirectory}avatar/`;
const MANIFEST = `${DIR}manifest.json`;

export interface AvatarManifest {
  /** ISO dates of the first scan and the most recent. */
  firstScan: string;
  latestScan: string;
  /** How many images have been made, so re-renders bust image caches. */
  version: number;
}

const Base64 = FileSystem.EncodingType.Base64;

const uri = (name: string) => `${DIR}${name}.jpg`;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

export async function loadManifest(): Promise<AvatarManifest | null> {
  try {
    return JSON.parse(await FileSystem.readAsStringAsync(MANIFEST)) as AvatarManifest;
  } catch {
    return null;
  }
}

async function saveManifest(m: AvatarManifest) {
  await FileSystem.writeAsStringAsync(MANIFEST, JSON.stringify(m));
}

export async function saveImage(name: string, base64: string): Promise<string> {
  await ensureDir();
  await FileSystem.writeAsStringAsync(uri(name), base64, { encoding: Base64 });
  return uri(name);
}

export async function imageIfExists(name: string): Promise<string | null> {
  const info = await FileSystem.getInfoAsync(uri(name));
  return info.exists ? uri(name) : null;
}

export function readImage(name: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri(name), { encoding: Base64 });
}

/**
 * Stores a new scan. The first one is kept forever as "before"; a later scan
 * becomes "latest", and everything drawn from the old one is cleared.
 */
export async function storeScan(base64: string): Promise<AvatarManifest> {
  await ensureDir();
  const now = new Date().toISOString();
  const existing = await loadManifest();

  if (!existing) {
    await saveImage("first", base64);
  } else {
    const files = await FileSystem.readDirectoryAsync(DIR);
    await Promise.all(files.filter((f) => f.startsWith("mood-") || f.startsWith("scene-")).map((f) => FileSystem.deleteAsync(`${DIR}${f}`, { idempotent: true })));
  }
  await saveImage("latest", base64);

  const manifest: AvatarManifest = {
    firstScan: existing?.firstScan ?? now,
    latestScan: now,
    version: (existing?.version ?? 0) + 1,
  };
  await saveManifest(manifest);
  return manifest;
}

export async function deleteAvatar() {
  await FileSystem.deleteAsync(DIR, { idempotent: true });
}

/** The face to show around the app: a portrait if there is one. */
export async function avatarPortrait(): Promise<string | null> {
  return (await imageIfExists("mood-calm")) ?? (await imageIfExists("latest"));
}
