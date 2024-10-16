import { Ajv } from 'ajv';
import { S } from 'fluent-json-schema';

import { Alignment, DescriptionPlacement, ItemGeolocation, MaxWidth } from '@graasp/sdk';

import { Item } from './entities/Item';

const geolocation = S.object().prop('lat', S.number()).prop('lng', S.number());

const settings = S.object()
  // Setting additional properties to false will only filter out invalid properties.
  .additionalProperties(false)
  // lang is deprecated
  .prop('lang', S.string())
  .prop('isPinned', S.boolean())
  .prop('tags', S.array())
  .prop('showChatbox', S.boolean())
  .prop('isResizable', S.boolean())
  .prop('hasThumbnail', S.boolean())
  .prop('ccLicenseAdaption', S.string())
  .prop('displayCoEditors', S.boolean())
  .prop('descriptionPlacement', S.enum(Object.values(DescriptionPlacement)))
  .prop('isCollapsible', S.boolean())
  .prop('enableSaveActions', S.boolean())
  // link settings
  .prop('showLinkIframe', S.boolean())
  .prop('showLinkButton', S.boolean())
  // file settings
  .prop('maxWidth', S.enum(Object.values(MaxWidth)))
  .prop('alignment', S.enum(Object.values(Alignment)));

/**
 * Declare compiled validators to be used in manual validation
 */
const ajv = new Ajv({ allErrors: true });
export const validateSettings = ajv.compile<Item['settings']>(settings.valueOf());
// const validateExtra = ajv.compile(extra.valueOf());
export const validateGeolocation = ajv.compile<Pick<ItemGeolocation, 'lat' | 'lng'>>(
  geolocation.valueOf(),
);
