// import {
//   BaseEntity,
//   CreateDateColumn,
//   Entity,
//   JoinColumn,
//   ManyToOne,
//   PrimaryGeneratedColumn,
//   Unique,
// } from 'typeorm';
// import { v4 } from 'uuid';

// import { Member } from '../../../../member/entities/member';
// import { PackedItem } from '../../../ItemWrapper';
// import { Item } from '../../../entities/Item';

// @Entity({ name: 'item_favorite' })
// @Unique('favorite_key', ['member', 'item'])
// export class ItemFavorite extends BaseEntity {
//   @PrimaryGeneratedColumn('uuid')
//   id: string = v4();

//   @ManyToOne(() => Member, (member) => member.id, {
//     onDelete: 'CASCADE',
//     nullable: false,
//   })
//   @JoinColumn({ name: 'member_id' })
//   member: Member;

//   @ManyToOne(() => Item, (item) => item.id, {
//     onUpdate: 'CASCADE',
//     onDelete: 'CASCADE',
//     nullable: false,
//   })
//   @JoinColumn({ name: 'item_id' })
//   item: Item;

//   @CreateDateColumn({ name: 'created_at', nullable: false })
//   createdAt: Date;
// }

// export type PackedItemFavorite = Pick<ItemFavorite, 'id' | 'createdAt' | 'member'> & {
//   item: PackedItem;
// };
