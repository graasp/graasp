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
  Member as GraaspMember,
  MemberExtra,
  MemberType,
  UnknownExtra,
  isPseudonymizedMember,
} from '@graasp/sdk';

@Entity()
@Unique('email', ['email'])
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
}

export type Actor = Member | undefined;
