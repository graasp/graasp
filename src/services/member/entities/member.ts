import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { CompleteMember, MemberType } from '@graasp/sdk';
import { DEFAULT_LANG } from '@graasp/translations';

@Entity()
@Unique('email', ['email'])
export class Member extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    nullable: false,
    length: 100,
  })
  name: string;

  @Column({
    nullable: false,
    length: 150,
    unique: true,
  })
  email: string;

  @Column({
    nullable: false,
    default: MemberType.Individual,
    enum: Object.values(MemberType),
  })
  type: `${MemberType}` | MemberType;

  @Column('simple-json', { nullable: false, default: '{}' })
  extra: CompleteMember['extra'];

  @Column({
    nullable: true,
    name: 'user_agreements_date',
  })
  userAgreementsDate: Date;

  @Column({
    nullable: false,
    name: 'enable_save_actions',
    default: true,
  })
  enableSaveActions: boolean;

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

  get lang(): string {
    return (this.extra.lang as string) ?? DEFAULT_LANG;
  }
}

export type Actor = Member | undefined;
