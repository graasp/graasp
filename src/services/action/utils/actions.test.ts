import { Context } from '@graasp/sdk';

import { BUILDER_HOST } from '../../../utils/config.js';
import { getGeolocationIp, getView } from './actions.js';

describe('Action Utils', () => {
  it('check geolocation and view properties', async () => {
    // create a request with valid ip and headers to test view and geolocation
    const ip = '192.158.1.38';

    const geolocation = getGeolocationIp(ip);
    expect(geolocation).toBeTruthy();
  });

  it('should return a valid view', () => {
    const headers = {
      origin: `https://${BUILDER_HOST.url.hostname}`,
    };
    const view = getView(headers);
    expect(view).toEqual(BUILDER_HOST.name);
  });

  it('should return an unknown view', () => {
    const headers = {
      origin: 'https://bababubu.com',
    };
    const view = getView(headers);
    expect(view).toEqual(Context.Unknown);
  });
});
