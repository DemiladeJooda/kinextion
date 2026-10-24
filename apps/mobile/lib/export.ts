/**
 * Download my data: fetch the export and hand it to the share sheet, so it
 * can go to Files, AirDrop, email or anywhere else the phone offers.
 *
 * expo-sharing is native; a build without it can't share a file, and says
 * so instead of crashing.
 */

import { File, Paths } from "expo-file-system";
import { dataApiBaseUrl, deviceTimeZone } from "../services/client";

type SharingModule = typeof import("expo-sharing");
let Sharing: SharingModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Sharing = require("expo-sharing") as SharingModule;
} catch {
  Sharing = null;
}

export const exportSupported = Sharing !== null;

export async function downloadMyData(token: string | null): Promise<void> {
  if (!Sharing || !(await Sharing.isAvailableAsync())) {
    throw new Error("This version of the app can't share files yet. Update the app and try again.");
  }
  const tz = deviceTimeZone();
  const res = await fetch(`${dataApiBaseUrl()}/api/users/me/export`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tz ? { "X-Time-Zone": tz } : {}),
    },
  });
  if (res.status === 429) throw new Error("You've downloaded a few times this hour. Try again later.");
  if (!res.ok) throw new Error("Couldn't prepare your data. Try again.");
  const file = new File(Paths.cache, `kinextion-export-${new Date().toISOString().slice(0, 10)}.json`);
  if (file.exists) file.delete();
  file.write(await res.text());
  await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: "Your Kinextion data" });
}
