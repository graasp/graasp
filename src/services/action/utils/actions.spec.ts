import { describe, expect, it } from 'vitest';

import { getGeolocationIp } from './actions';

describe('Action Utils', () => {
  it('check geolocation and view properties', async () => {
    // create a request with valid ip and headers to test view and geolocation
    const ip = '192.158.1.38';

    const geolocation = getGeolocationIp(ip);
    expect(geolocation).toBeTruthy();
  });
});
