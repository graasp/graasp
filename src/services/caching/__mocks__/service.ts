import { ICachingService } from '../interfaces.js';

export class CachingService implements ICachingService {
  private readonly cache: Map<string, string> = new Map();

  async add(filePath: string, url: string) {
    this.cache.set(filePath, url);
  }

  async get(filePath: string) {
    return this.cache.get(filePath) ?? null;
  }

  async getOrCache(filePath: string, newUrl: () => Promise<string>) {
    const cachedUrl = await this.get(filePath);

    if (cachedUrl) {
      return cachedUrl;
    }

    const url = await newUrl();

    await this.add(filePath, url);

    return url;
  }

  async delete(filePath: string) {
    this.cache.delete(filePath);
  }

  async deleteMany(filePaths: string[]) {
    filePaths.forEach((filepath) => this.cache.delete(filepath));
  }
}
