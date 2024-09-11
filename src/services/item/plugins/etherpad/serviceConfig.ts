/* 
import { singleton } from 'tsyringe';

import {
  ETHERPAD_API_KEY,
  ETHERPAD_COOKIE_DOMAIN,
  ETHERPAD_PUBLIC_URL,
  ETHERPAD_URL,
} from '../../../../utils/config';
import { ETHERPAD_API_VERSION } from './constants';

export const API_KEY_FORMAT = /^[a-f\d]{64}$/;

@singleton()
export class EtherpadServiceConfig {
  public readonly url: string;
  public readonly apiKey: string;
  public readonly publicUrl: string;
  public readonly cookieDomain: string;
  public readonly apiVersion: string;

  public constructor() {
    // URL and ApiKey are validated on read in the config file.
    this.url = ETHERPAD_URL;
    this.apiKey = ETHERPAD_API_KEY;
    this.publicUrl = ETHERPAD_PUBLIC_URL ?? this.url;
    this.cookieDomain = ETHERPAD_COOKIE_DOMAIN ?? new URL(this.publicUrl).hostname;
    this.apiVersion = ETHERPAD_API_VERSION;
  }
}
*/
