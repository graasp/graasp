import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Member } from '../../member/entities/member';

@Entity()
@Unique('member-profile', ['member'])
export class MemberProfile extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Member, (member) => member.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'member_id' })
  member: Member;

  @Column({
    nullable: true,
    length: 5000,
  })
  bio: string;

  @Column({
    nullable: false,
    default: false,
  })
  visibility: boolean;

  @Column({
    nullable: true,
  })
  facbookLink: string;

  @Column({
    nullable: true,
  })
  linkedinLink: string;

  @Column({
    nullable: true,
  })
  twitterLink: string;

  @CreateDateColumn({ name: 'created_at', nullable: false })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', nullable: false })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
}
