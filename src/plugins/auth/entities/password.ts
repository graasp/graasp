import { Entity, PrimaryGeneratedColumn, OneToOne, Column, UpdateDateColumn, CreateDateColumn, Unique, BaseEntity, JoinColumn } from 'typeorm';
import { Member } from '../../../services/members/member';

@Entity()
@Unique('member-password', ['member'])
export class MemberPassword extends BaseEntity {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Member, member => member.id, { onDelete: 'CASCADE' })
  @JoinColumn()
  member: Member;

  @Column({
    length: 100,
  })
  password: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
