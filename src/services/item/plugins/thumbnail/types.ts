import { ThumbnailSizeInPackedItem, type ThumbnailsBySize } from '@graasp/sdk';

export type ItemsThumbnails = { [itemId: string]: Partial<ThumbnailsBySize> };
export type ItemThumbnailSize = keyof typeof ThumbnailSizeInPackedItem;
