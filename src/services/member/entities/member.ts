import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import {
  DEFAULT_LANG,
  Member as GraaspMember,
  MemberExtra,
  MemberType,
  UnknownExtra,
  isPseudonymizedMember,
} from '@graasp/sdk';

@Entity()
@Unique('email', ['email'])
export class Member<Extra extends UnknownExtra = MemberExtra>
  extends BaseEntity
  implements GraaspMember
{
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

  // TODO: USED?
  get isPseudonymized(): boolean {
    return isPseudonymizedMember(this.email);
  }

  get lang(): string {
    return (this.extra.lang as string) ?? DEFAULT_LANG;
  }
}

export type Actor = Member | undefined;
