import { ThumbnailSizeInPackedItem, ThumbnailsBySize } from '@graasp/sdk';

export type ItemsThumbnails = { [itemId: string]: ThumbnailsBySize };
export type ItemThumbnailSize = keyof typeof ThumbnailSizeInPackedItem;
