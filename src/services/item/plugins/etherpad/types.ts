export interface EtherpadPluginOptions {
  /**
   * URL (incl. protocol and port) of the etherpad server
   */
  url: string;
  /**
   * Public URL (incl. protocol and port) of the etherpad server, e.g.
   * if the back-end communicates with the etherpad service through a
   * private network (optional, will default to {@link url})
   */
  publicUrl?: string;
  /**
   * Cookie domain to be used for the etherpad cookie (optional, will default
   * to the hostname of {@link url})
   */
  cookieDomain?: string;
  /**
   * secret api key to authorize this app against the etherpad server
   */
  apiKey: string;
}
