import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Member } from '../../../entities/member';

@Entity()
@Unique('member-profile', ['member'])
export class MemberProfile extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @OneToOne(() => Member, (member) => member.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'member_id' })
  member: Member;

  @Column({
    nullable: true,
    length: 5000,
    type: 'varchar',
  })
  bio: string;

  @Column({
    nullable: false,
    default: false,
    type: 'varchar',
  })
  visibility: boolean;

  @Column({
    nullable: true,
    length: 100,
    type: 'varchar',
  })
  facebookID: string;

  @Column({
    nullable: true,
    length: 100,
    type: 'varchar',
  })
  linkedinID: string;

  @Column({
    nullable: true,
    length: 100,
    type: 'varchar',
  })
  twitterID: string;

  @CreateDateColumn({ name: 'created_at', nullable: false })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', nullable: false })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
}
