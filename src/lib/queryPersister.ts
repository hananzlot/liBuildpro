import { get, set, del } from "idb-keyval";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

const CACHE_KEY = "react-query-cache";

/**
 * Creates an IndexedDB persister for React Query cache.
 * This allows query data to survive browser refreshes and tab closes.
 */
export function createIDBPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      try {
        await set(CACHE_KEY, client);
      } catch (error) {
        console.warn("Failed to persist query cache:", error);
      }
    },
    restoreClient: async () => {
      try {
        return await get<PersistedClient>(CACHE_KEY);
      } catch (error) {
        console.warn("Failed to restore query cache:", error);
        return undefined;
      }
    },
    removeClient: async () => {
      try {
        await del(CACHE_KEY);
      } catch (error) {
        console.warn("Failed to remove query cache:", error);
      }
    },
  };
}
