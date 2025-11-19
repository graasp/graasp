import { describe, expect, it } from 'vitest';

import { ItemType, ItemValidationStatus, PublicationStatus } from '@graasp/sdk';

import { PublicationState } from './publicationState';
import { ItemMetadataFactory, ItemValidationGroupStatusFactory } from './test/fixtures';

describe('PublicationState', () => {
  describe('Private item', () => {
    const privateItem = ItemMetadataFactory();

    it('Item is not published', () => {
      const publicationState = new PublicationState(privateItem);
      expect(publicationState.computeStatus()).toBe(PublicationStatus.Unpublished);
    });

    it('Item is not published if it is private and outdated', () => {
      const validationGroup = ItemValidationGroupStatusFactory(privateItem, {
        isOutDated: true,
      });
      const publicationState = new PublicationState(privateItem, { validationGroup });
      expect(publicationState.computeStatus()).toBe(PublicationStatus.Unpublished);
    });

    it('Validation is pending', () => {
      const publicationState = new PublicationState(privateItem, { isValidationInProgress: true });
      expect(publicationState.computeStatus()).toBe(PublicationStatus.Pending);
    });

    it('Validation failed', () => {
      const validationGroup = ItemValidationGroupStatusFactory(privateItem, {
        status: ItemValidationStatus.Failure,
      });
      const publicationState = new PublicationState(privateItem, { validationGroup });
      expect(publicationState.computeStatus()).toBe(PublicationStatus.Invalid);
    });

    it('Item is ready to be published', () => {
      const validationGroup = ItemValidationGroupStatusFactory(privateItem, {
        status: ItemValidationStatus.Success,
      });
      const publicationState = new PublicationState(privateItem, { validationGroup });
      expect(publicationState.computeStatus()).toBe(PublicationStatus.ReadyToPublish);
    });

    it('Item type cannot be published', () => {
      const appItem = ItemMetadataFactory({ type: ItemType.APP });
      const publicationState = new PublicationState(appItem);
      expect(publicationState.computeStatus()).toBe(PublicationStatus.ItemTypeNotAllowed);
    });
  });

  describe('Public item', () => {
    const itemIsPublic = true;
    const publicItem = ItemMetadataFactory({}, itemIsPublic);

    it("Item's parent is already published", () => {
      const publicChildrenItem = ItemMetadataFactory(
        {
          parentItem: publicItem,
        },
        itemIsPublic,
      );
      const publicationState = new PublicationState(publicChildrenItem, {
        publishedItem: publicItem,
      });
      expect(publicationState.computeStatus()).toBe(PublicationStatus.PublishedChildren);
    });

    it('Children of published parent can be any type of item', () => {
      const publicAppChildrenItem = ItemMetadataFactory(
        {
          parentItem: publicItem,
        },
        itemIsPublic,
      );
      const publicationState = new PublicationState(publicAppChildrenItem, {
        publishedItem: publicItem,
      });
      expect(publicationState.computeStatus()).toBe(PublicationStatus.PublishedChildren);
    });

    it('Item is published', () => {
      const validationGroup = ItemValidationGroupStatusFactory(publicItem, {
        status: ItemValidationStatus.Success,
      });
      const publicationState = new PublicationState(publicItem, {
        validationGroup,
        publishedItem: publicItem,
      });
      expect(publicationState.computeStatus()).toBe(PublicationStatus.Published);
    });

    it('Item is outdated', () => {
      const validationGroup = ItemValidationGroupStatusFactory(publicItem, {
        isOutDated: true,
      });
      const publicationState = new PublicationState(publicItem, {
        validationGroup,
        publishedItem: publicItem,
      });
      expect(publicationState.computeStatus()).toBe(PublicationStatus.Outdated);
    });
  });
});
