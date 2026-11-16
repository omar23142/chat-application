/**
 * `@nestjs/cache-manager` is published as ESM-only, which Jest cannot require
 * in this setup. Unit tests replace the cache with a fake anyway, so we only
 * need the dependency-injection token. This stub keeps the token identical to
 * the real package (`CACHE_MANAGER = 'CACHE_MANAGER'`).
 */
export const CACHE_MANAGER = 'CACHE_MANAGER';

export interface Cache {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  wrap<T = unknown>(
    key: string,
    loader: () => Promise<T>,
    ttl?: number
  ): Promise<T>;
}
