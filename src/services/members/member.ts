import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { MemberType, UnknownExtra } from '@graasp/sdk';


type MemberExtra = {
  hasThumbnail?: boolean;
  lang?: string;
};

@Entity()
@Unique('id', ['id'])
export class Member<Extra extends UnknownExtra = MemberExtra> extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    nullable: false,
    length: 100,
  })
  name: string;

  @Column({
    nullable: false,
    length: 100,
    unique: true,
  })
  email: string;

  @Column({
    nullable: false,
    default: MemberType.Individual,
  })
  type: MemberType;

  @Column('simple-json', { nullable: false, default: '{}' })
  extra: Extra;

  @CreateDateColumn({
    update: false,
    name: 'created_at',
    nullable: false,
  })
  createdAt: Date;

  @UpdateDateColumn({
    update: false,
    name: 'updated_at',
    nullable: false,
  })
  updatedAt: Date;
}
