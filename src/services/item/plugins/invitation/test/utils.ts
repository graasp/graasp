import { faker } from '@faker-js/faker';

import { PermissionLevel } from '@graasp/sdk';

import { AppDataSource } from '../../../../../plugins/datasource';
import { Member } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import { ItemTestUtils } from '../../../test/fixtures/items';
import { Invitation } from '../entity';

const invitationRawRepository = AppDataSource.getRepository(Invitation);

const testUtils = new ItemTestUtils();

export const createInvitations = async ({
  member,
  parentItem,
}: {
  member: Member;
  parentItem?: Item;
}) => {
  const { item } = await testUtils.saveItemAndMembership({ member, parentItem });
  const invitations = Array.from({ length: 3 }, () =>
    invitationRawRepository.create({
      item,
      creator: member,
      permission: PermissionLevel.Read,
      email: faker.internet.email().toLowerCase(),
    }),
  );
  return { item, invitations };
};

export const saveInvitations = async ({ member }: { member: Member }) => {
  const { item, invitations } = await createInvitations({ member });
  for (const inv of invitations) {
    await invitationRawRepository.save(inv);
  }
  return { item, invitations };
};
