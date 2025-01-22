import { BaseEntity, DataSource } from 'typeorm';
import { v4 } from 'uuid';

import {
  DocumentItemFactory,
  FolderItemFactory,
  ItemType,
  MemberFactory,
  PermissionLevel,
  buildPathFromIds,
} from '@graasp/sdk';

import { AppDataSource } from '../../src/plugins/datasource';
import { Item } from '../../src/services/item/entities/Item';
import { ItemMembership } from '../../src/services/itemMembership/entities/ItemMembership';
import { Member } from '../../src/services/member/entities/member';
import defaultDatas from './sampledatas';

export type TableType<C extends BaseEntity, E> = {
  constructor: new () => C;
} & (
  | {
      factory: (e: Partial<E>) => E;
      entities: Partial<E>[];
    }
  | {
      factory?: never;
      entities: E[];
    }
);

/**
 * Push datas in Database with TypeOrm.
 * Use the constructors and the datas given in parameter to build BaseEntity object and save them on the Postgresql Database.
 * Integrity constraints are checked on the database, and will throw an exception if needed.
 * @param datas Datas to be pushed. Should contains constructor to build BaseEntity objects and sometimes Factory function to have default data.
 */
export default async function seed(
  datas: { [K in string]: TableType<BaseEntity, object> } = defaultDatas,
) {
  // Initialise Database
  const db: DataSource = AppDataSource;
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  const result: { [K in keyof typeof datas]: BaseEntity[] } = {};
  // Begin transation.
  await db.transaction(async (manager) => {
    for (const key in datas) {
      const table = datas[key];
      const entities: BaseEntity[] = [];
      for (const mockEntity of table.entities) {
        const entity: BaseEntity = new table.constructor();
        Object.assign(entity, table.factory ? table.factory(mockEntity) : mockEntity);
        const e = await manager.save(entity);
        entities.push(e);
      }
      result[key] = entities;
    }
  });
  return result;
}

type SeedActor = 'actor' | Member;
type DataType = {
  actor?: SeedActor | null;
  members?: Partial<Member>[];
  items?: ((Partial<Item> | { creator: 'actor' }) & {
    children?: Partial<Item>[];
    memberships?: (
      | Partial<ItemMembership>
      | { account?: 'actor'; creator?: 'actor'; permission?: PermissionLevel }
    )[];
  })[];
};

/**
 *
 * @param data
 * - actor: if not null, will create defined actor, or random actor if null
 * - items: if memberships is not defined, set default permission to admin. Can specify 'actor' in member.
 * - members: if
 * @returns
 */
export async function seedFromJson(data: DataType = {}) {
  const { items, actor, members } = data;

  const result: any = {};

  // process 'actor'
  const actorIsDefinedWithString = items?.some(
    (i) => i.creator === 'actor' || i.memberships?.some((m) => m.account === 'actor'),
  );
  let actorData;
  if (actorIsDefinedWithString) {
    actorData = {};
  }
  if (actorData || actor !== null) {
    result.actor = (
      await seed({
        actor: {
          factory: MemberFactory,
          constructor: Member,
          entities: [actorData ?? {}],
        },
      })
    ).actor[0];
  }

  // if (actor !== null) {
  //   const actorData = await seed({
  //     actor: {
  //       factory: MemberFactory,
  //       constructor: Member,
  //       entities: [actor ?? {}],
  //     },
  //   });
  //   result.actor = actorData.actor[0];
  // }

  const membersEntity = members?.map((m) => m);
  if (membersEntity) {
    result.members = await seed({
      members: {
        factory: MemberFactory,
        constructor: Member,
        entities: membersEntity,
      },
    });
  }

  // TODO: recursive
  const generateId = (i: any, parent?: any) => {
    const id = v4();
    const path = buildPathFromIds(...[parent?.id, id].filter(Boolean));
    return { type: ItemType.FOLDER, id, path, ...i, creator: result.actor?.id ?? null };
  };

  const itemsEntity = items?.flatMap((i) => {
    const parent = generateId(i);
    return [parent, ...(i.children?.map((c) => generateId(c, parent)) ?? [])];
  });
  if (itemsEntity) {
    const folders = itemsEntity.filter((i) => i.type === ItemType.FOLDER);
    const documents = itemsEntity.filter((i) => i.type === ItemType.DOCUMENT);

    result.items = Object.values(
      await seed({
        folders: {
          // TODO: update factory
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          factory: (i) => ({ ...FolderItemFactory(i), order: i.order ?? null }),
          constructor: Item,
          entities: folders,
        },
        documents: {
          // TODO: update factory
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          factory: (i) => ({ ...DocumentItemFactory(i), order: i.order ?? null }),
          constructor: Item,
          entities: documents,
        },
      }),
    ).flatMap((v) => v);
  }

  const itemMembershipsEntity = itemsEntity
    ?.flatMap((i) => i.memberships?.map((im) => ({ ...im, item: i })) ?? [])
    ?.map((im) => ({
      permission: PermissionLevel.Admin,
      ...im,
      creator: im?.creator === 'actor' ? result.actor : im?.creator,
      account: im?.account === 'actor' ? result.actor : im?.account,
    }));
  if (itemMembershipsEntity) {
    result.itemMemberships = (
      await seed({
        itemMemberships: {
          constructor: ItemMembership,
          entities: itemMembershipsEntity,
        },
      })
    ).itemMemberships;
  }

  return result;

  // return await seed({
  //         folders: {
  //           factory: FolderItemFactory,
  //           constructor: Item,
  //           entities: [
  //             { id: rootUUID, creator: actor?.id },
  //             { id: folderUUID, creator: actor?.id, path: buildPathFromIds(rootUUID, folderUUID) },
  //           ],
  //         },
  //         subItems: {
  //           factory: AppItemFactory,
  //           constructor: Item,
  //           entities: [
  //             {
  //               id: hiddenUUID,
  //               path: buildPathFromIds(rootUUID, hiddenUUID),
  //               creator: actor?.id,
  //             },
  //             {
  //               id: publicUUID,
  //               path: buildPathFromIds(rootUUID, publicUUID),
  //               creator: actor?.id,
  //             },
  //           ],
  //         },
  //         itemMembership: {
  //           constructor: ItemMembership,
  //           entities: itemsData.flatMap(({memberships})=> memberships).map(im=>
  //             {
  //               item: buildPathFromIds(rootUUID),
  //               account: actor?.id,
  //               permission: PermissionLevel.Admin,
  //             },
  //           ),
  //         },
  //         itemVisibilities: {
  //           constructor: ItemVisibility,
  //           entities: [
  //             {
  //               type: ItemVisibilityType.Hidden,
  //               item: buildPathFromIds(rootUUID, hiddenUUID),
  //             },
  //             {
  //               type: ItemVisibilityType.Public,
  //               item: buildPathFromIds(rootUUID, publicUUID),
  //             },
  //           ],
  //         },
  //       });
}
