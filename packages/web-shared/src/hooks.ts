'use client';
import useSWR, { type SWRConfiguration } from 'swr';
import { api, type RequestOptions } from './api';

/**
 * Data fetching with caching/revalidation. Pass `null` as path to skip.
 * Query params are part of the cache key so filters refetch automatically.
 */
export function useApi<T = any>(path: string | null, query?: RequestOptions['query'], config?: SWRConfiguration<T>) {
  const key = path ? [path, JSON.stringify(query ?? {})] : null;
  return useSWR<T>(key, () => api<T>(path!, { query }), { revalidateOnFocus: false, ...config });
}

export { mutate } from 'swr';
