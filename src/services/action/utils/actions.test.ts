import { CLIENT_HOSTS } from '../../test/constants';
import { VIEW_UNKNOWN_NAME } from '../constants/constants';
import { getGeolocationIp, getView } from './actions';

const BUILDER_CLIENT_HOST = CLIENT_HOSTS[0];

describe('Action Utils', () => {
  it('check geolocation and view properties', async () => {
    // create a request with valid ip and headers to test view and geolocation
    const ip = '192.158.1.38';

    const geolocation = getGeolocationIp(ip);
    expect(geolocation).toBeTruthy();
  });

  it('should return a valid view', () => {
    const headers = {
      origin: `https://${BUILDER_CLIENT_HOST.hostname}`,
    };
    const view = getView(headers, CLIENT_HOSTS);
    expect(view).toEqual(BUILDER_CLIENT_HOST.name);
  });

  it('should return an unknown view', () => {
    const headers = {
      origin: 'https://bababubu.com',
    };
    const view = getView(headers, CLIENT_HOSTS);
    expect(view).toEqual(VIEW_UNKNOWN_NAME);
  });
});
