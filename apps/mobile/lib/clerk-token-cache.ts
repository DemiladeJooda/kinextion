/**
 * Persists Clerk session tokens in the device keychain/keystore so a signed-in
 * user doesn't have to re-authenticate every time the app is relaunched.
 */

import * as SecureStore from "expo-secure-store";
import type { TokenCache } from "@clerk/clerk-expo";

export const tokenCache: TokenCache = {
  async getToken(key) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key, value) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Write failed (e.g. no keychain available) — session just won't persist.
    }
  },
};
