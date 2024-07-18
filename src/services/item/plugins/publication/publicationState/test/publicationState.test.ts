import { ItemType, ItemValidationStatus, PublicationStatus } from '@graasp/sdk';

import { PublicationState } from '../publicationState';
import { ItemMetadataFactory, ItemValidationGroupStatusFactory } from './fixtures';

describe('PublicationState', () => {
  describe('Private item', () => {
    const privateItem = ItemMetadataFactory();

    it('Item is not published', () => {
      const publicationState = new PublicationState(privateItem);
      expect(publicationState.computeStatus()).toBe(PublicationStatus.Unpublished);
    });

    it('Validation is pending', () => {
      const validationGroup = ItemValidationGroupStatusFactory(privateItem, {
        status: ItemValidationStatus.Pending,
      });
      const publicationState = new PublicationState(privateItem, validationGroup);
      expect(publicationState.computeStatus()).toBe(PublicationStatus.Pending);
    });

    it('Validation failed', () => {
      const validationGroup = ItemValidationGroupStatusFactory(privateItem, {
        status: ItemValidationStatus.Failure,
      });
      const publicationState = new PublicationState(privateItem, validationGroup);
      expect(publicationState.computeStatus()).toBe(PublicationStatus.Invalid);
    });

    it('Validation is outdated', () => {
      const validationGroup = ItemValidationGroupStatusFactory(privateItem, {
        isOutDated: true,
      });
      const publicationState = new PublicationState(privateItem, validationGroup);
      expect(publicationState.computeStatus()).toBe(PublicationStatus.Outdated);
    });

    it('Item is ready to be published', () => {
      const validationGroup = ItemValidationGroupStatusFactory(privateItem, {
        status: ItemValidationStatus.Success,
      });
      const publicationState = new PublicationState(privateItem, validationGroup);
      expect(publicationState.computeStatus()).toBe(PublicationStatus.ReadyToPublish);
    });

    it('Published private item should be set to public again', () => {
      const validationGroup = ItemValidationGroupStatusFactory(privateItem, {
        status: ItemValidationStatus.Success,
      });
      const publicationState = new PublicationState(privateItem, validationGroup, privateItem);
      expect(publicationState.computeStatus()).toBe(PublicationStatus.NotPublic);
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
      const publicationState = new PublicationState(publicChildrenItem, undefined, publicItem);
      expect(publicationState.computeStatus()).toBe(PublicationStatus.PublishedChildren);
    });

    it('Children of published parent can be any type of item', () => {
      const publicAppChildrenItem = ItemMetadataFactory(
        {
          parentItem: publicItem,
        },
        itemIsPublic,
      );
      const publicationState = new PublicationState(publicAppChildrenItem, undefined, publicItem);
      expect(publicationState.computeStatus()).toBe(PublicationStatus.PublishedChildren);
    });

    it('Item is published', () => {
      const validationGroup = ItemValidationGroupStatusFactory(publicItem, {
        status: ItemValidationStatus.Success,
      });
      const publicationState = new PublicationState(publicItem, validationGroup, publicItem);
      expect(publicationState.computeStatus()).toBe(PublicationStatus.Published);
    });
  });
});
