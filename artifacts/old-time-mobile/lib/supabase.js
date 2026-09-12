import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const SUPABASE_AUTH_CONFIGURED = Boolean(supabaseUrl && supabasePublishableKey);

const clientUrl = supabaseUrl ?? 'https://old-time.invalid';
const clientPublishableKey = supabasePublishableKey ?? 'old-time-missing-supabase-public-key';

// Keep this namespace separate from entries written by older builds. A stale
// Keychain item can fail inside the native module before JS can catch it.
const SECURE_STORAGE_PREFIX = 'old-time.supabase.v2.';
const SECURE_STORAGE_CHUNK_SIZE = 900;

function secureStorageKey(key) {
  return `${SECURE_STORAGE_PREFIX}${key}`;
}

function secureStorageMetadataKey(key) {
  return `${secureStorageKey(key)}.meta`;
}

function secureStorageChunkKey(key, index) {
  return `${secureStorageKey(key)}.chunk.${index}`;
}

function secureStorageError(operation) {
  return new Error(`Secure authentication storage ${operation} failed.`);
}

async function secureStoreGetItem(key) {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    throw secureStorageError('read');
  }
}

async function secureStoreSetItem(key, value) {
  try {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
  } catch {
    throw secureStorageError('write');
  }
}

async function secureStoreDeleteItem(key) {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    throw secureStorageError('delete');
  }
}

async function readSecureStorageMetadata(key) {
  const raw = await secureStoreGetItem(secureStorageMetadataKey(key));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const chunks = parsed.chunks;
    if (parsed.version !== 1 || typeof chunks !== 'number' || !Number.isSafeInteger(chunks) || chunks < 1) return null;
    return { version: 1, chunks };
  } catch {
    return null;
  }
}

const secureAuthStorage = {
  async getItem(key) {
    const metadata = await readSecureStorageMetadata(key);
    if (metadata) {
      const chunks = await Promise.all(
        Array.from({ length: metadata.chunks }, (_, index) =>
          secureStoreGetItem(secureStorageChunkKey(key, index)),
        ),
      );
      if (chunks.some((chunk) => chunk === null)) {
        throw new Error('Secure authentication storage is incomplete.');
      }
      return chunks.join('');
    }

    // Migrate an existing Supabase session once. No new auth data is written
    // to AsyncStorage after this migration succeeds.
    const legacyValue = await AsyncStorage.getItem(key);
    if (legacyValue === null) return null;
    await this.setItem(key, legacyValue);
    await AsyncStorage.removeItem(key);
    return legacyValue;
  },

  async setItem(key, value) {
    const previous = await readSecureStorageMetadata(key);
    const chunks = [];
    for (let start = 0; start < value.length; start += SECURE_STORAGE_CHUNK_SIZE) {
      chunks.push(value.slice(start, start + SECURE_STORAGE_CHUNK_SIZE));
    }
    if (chunks.length === 0) chunks.push('');

    // Write the new chunks before committing metadata, so an interrupted
    // write leaves the previous complete value discoverable.
    await Promise.all(
      chunks.map((chunk, index) =>
        secureStoreSetItem(secureStorageChunkKey(key, index), chunk),
      ),
    );
    await secureStoreSetItem(
      secureStorageMetadataKey(key),
      JSON.stringify({ version: 1, chunks: chunks.length }),
    );

    if (previous && previous.chunks > chunks.length) {
      await Promise.all(
        Array.from({ length: previous.chunks - chunks.length }, (_, offset) =>
          secureStoreDeleteItem(secureStorageChunkKey(key, chunks.length + offset)),
        ),
      );
    }
  },

  async removeItem(key) {
    const metadata = await readSecureStorageMetadata(key);
    if (metadata) {
      await Promise.all(
        Array.from({ length: metadata.chunks }, (_, index) =>
          secureStoreDeleteItem(secureStorageChunkKey(key, index)),
        ),
      );
    }
    await secureStoreDeleteItem(secureStorageMetadataKey(key));
    // Clean up any legacy session that may not have been migrated yet.
    await AsyncStorage.removeItem(key);
  },
};

const authStorage = Platform.OS === 'web' ? AsyncStorage : secureAuthStorage;

export const supabase = createClient(clientUrl, clientPublishableKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    // The Expo Router callback screen explicitly exchanges the OAuth code.
    // Automatic web URL detection would consume the same one-time code first.
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

export default supabase;
