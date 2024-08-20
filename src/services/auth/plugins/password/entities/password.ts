import { Entity, JoinColumn, OneToOne, Unique } from 'typeorm';

import { Member } from '../../../../member/entities/member';
import { AbstractPassword } from './abstractPassword';

@Entity()
@Unique('UQ_member_password_member_id', ['member'])
export class MemberPassword extends AbstractPassword {
  @OneToOne(() => Member, (member) => member.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'member_id', foreignKeyConstraintName: 'FK_member_password_member_id' })
  member: Member;
}
