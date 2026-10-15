import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "bengol_delivery_token";

/* The sign-in token lives in the phone's secure storage. Reading it there
   means a trip to the system keystore and a decryption, and it was being
   read before EVERY request the app makes, so each one waited for that
   first. The token is now read from secure storage once and kept in memory
   for as long as the app is open; secure storage stays the only place it is
   ever written to disk.

   `undefined` means "not read yet"; `null` means "read, and there is none". */
let cached: string | null | undefined;
let reading: Promise<string | null> | null = null;

export const tokenStorage = {
  async get(): Promise<string | null> {
    if (cached !== undefined) return cached;

    // Several requests starting together share the one read
    reading ??= SecureStore.getItemAsync(TOKEN_KEY)
      /* Secure storage can refuse to give the token back (the phone's
         keystore no longer has the key it was locked with, after a restore
         or a system update). That means "not signed in". Left as an error
         it stopped the app on its opening screen for good, since nothing
         could ever be read. The entry that cannot be opened is removed. */
      .catch(() => {
        SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
        return null;
      })
      .then((token) => {
        // A sign-in or sign-out that finished while this was reading wins
        if (cached === undefined) cached = token;
        return cached ?? null;
      })
      .finally(() => {
        reading = null;
      });

    return reading;
  },
  /* Neither of these fails the sign-in or the sign-out it is part of when
     secure storage will not be written to. A token that could not be saved
     still works until the app is closed; one that could not be removed is
     already forgotten here, and a sign-out that stopped half-way left the
     app looking signed in with no token to send. */
  async set(token: string): Promise<void> {
    cached = token;
    await SecureStore.setItemAsync(TOKEN_KEY, token).catch(() => {});
  },
  async clear(): Promise<void> {
    cached = null;
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  },
};
