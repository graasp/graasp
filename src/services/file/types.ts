export type BuildFilePathFunction = (itemId: string, filename: string) => string;
export interface IServiceCaching {
  add(filePath: string, url: string, expiresInSeconds?: number): Promise<void>;

  get(filePath: string): Promise<string | null>;

  getOrCache(
    filePath: string,
    newUrl: () => Promise<string>,
    expiresInSeconds?: number,
  ): Promise<string | null>;

  delete(filePath: string): Promise<void>;
}
