export interface AppsPluginOptions {
  jwtSecret: string;
  /** In minutes. Defaults to 30 (minutes) */
  jwtExpiration?: number;

  publisherId: string;
}
