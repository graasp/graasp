import groupBy from 'lodash.groupby';

import { ItemValidationStatus, PublicationStatus, PublishableItemTypeChecker } from '@graasp/sdk';

import type { ItemMetadata, ItemValidationGroupStatus, MapByStatus } from './types';

export class PublicationState {
  private readonly item: ItemMetadata;
  private readonly isValidationInProgress?: boolean;
  private readonly validationGroup?: ItemValidationGroupStatus;
  private readonly publishedItem?: ItemMetadata;
  private readonly mapByStatus: MapByStatus;

  constructor(
    item: ItemMetadata,
    {
      isValidationInProgress,
      validationGroup,
      publishedItem,
    }: {
      isValidationInProgress?: boolean;
      validationGroup?: ItemValidationGroupStatus;
      publishedItem?: ItemMetadata;
    } = {},
  ) {
    this.item = item;
    this.isValidationInProgress = isValidationInProgress;
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

  private isUnpublishedAndOutdated() {
    return (
      !this.publishedItem &&
      this.validationGroup &&
      new Date(this.validationGroup.createdAt) <= new Date(this.item.updatedAt)
    );
  }

  private isUnpublished() {
    return !this.validationGroup || this.isUnpublishedAndOutdated();
  }

  private isPublishedChildren() {
    return Boolean(this.publishedItem) && this.publishedItem?.path !== this.item?.path;
  }

  private isTypeNotAllowedToBePublished() {
    return !PublishableItemTypeChecker.isItemTypeAllowedToBePublished(this.item.type);
  }

  public computeStatus(): PublicationStatus {
    switch (true) {
      case this.isValidationInProgress:
        return PublicationStatus.Pending;
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
      case this.containValidationStatus(ItemValidationStatus.Success):
        return this.computeValidationSuccess();
      default:
        return PublicationStatus.Invalid;
    }
  }
}
