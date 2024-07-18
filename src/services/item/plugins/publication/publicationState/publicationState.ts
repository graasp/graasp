import groupBy from 'lodash.groupby';

import { ItemValidationStatus, PublicationStatus, PublishableItemTypeChecker } from '@graasp/sdk';

import { ItemMetadata, ItemValidationGroupStatus, MapByStatus } from './types';

export class PublicationState {
  private readonly item: ItemMetadata;
  private readonly validationGroup?: ItemValidationGroupStatus;
  private readonly publishedItem?: ItemMetadata;
  private readonly mapByStatus: MapByStatus;

  constructor(
    item: ItemMetadata,
    validationGroup?: ItemValidationGroupStatus,
    publishedItem?: ItemMetadata,
  ) {
    this.item = item;
    this.validationGroup = validationGroup;
    this.publishedItem = publishedItem;
    this.mapByStatus = groupBy(validationGroup?.itemValidations, ({ status }) => status);
  }

  private containValidationStatus(status: ItemValidationStatus) {
    return (this.mapByStatus[status] ?? []).length > 0;
  }

  private isValidationOutdated() {
    return (
      this.validationGroup &&
      new Date(this.validationGroup.createdAt) <= new Date(this.item.updatedAt)
    );
  }

  private computeValidationSuccess() {
    if (this.publishedItem) {
      return PublicationStatus.Published;
    }

    return PublicationStatus.ReadyToPublish;
  }

  private isUnpublished() {
    return !this.validationGroup;
  }

  private isNotPublic() {
    return !this.item.public && Boolean(this.publishedItem);
  }

  private isPublishedChildren() {
    return Boolean(this.publishedItem) && this.publishedItem?.path !== this.item?.path;
  }

  private isTypeNotAllowedToBePublished() {
    return !PublishableItemTypeChecker.isItemTypeAllowedToBePublished(this.item.type);
  }

  public computeStatus(): PublicationStatus {
    switch (true) {
      case this.isPublishedChildren():
        return PublicationStatus.PublishedChildren;
      case this.isTypeNotAllowedToBePublished():
        return PublicationStatus.ItemTypeNotAllowed;
      case this.isUnpublished():
        return PublicationStatus.Unpublished;
      case this.isValidationOutdated():
        return PublicationStatus.Outdated;
      case this.containValidationStatus(ItemValidationStatus.Failure):
        return PublicationStatus.Invalid;
      case this.containValidationStatus(ItemValidationStatus.Pending):
        return PublicationStatus.Pending;
      case this.isNotPublic():
        return PublicationStatus.NotPublic;
      case this.containValidationStatus(ItemValidationStatus.Success):
        return this.computeValidationSuccess();
      default:
        return PublicationStatus.Invalid;
    }
  }
}
