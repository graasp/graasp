export interface ICachingService {
  add(filePath: string, url: string, expiresInSeconds?: number): Promise<void>;

  get(filePath: string): Promise<string | null>;

  getOrCache(
    filePath: string,
    newUrl: () => Promise<string>,
    expiresInSeconds?: number,
  ): Promise<string | null>;

  delete(filePath: string): Promise<void>;
}
