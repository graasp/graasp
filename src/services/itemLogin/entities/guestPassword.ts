import { Entity, JoinColumn, OneToOne, Unique } from 'typeorm';

import { AbstractPassword } from '../../auth/plugins/password/entities/abstractPassword';
import { Guest } from './guest';

@Entity()
@Unique('UQ_guest_password_guest_id', ['guest'])
export class GuestPassword extends AbstractPassword {
  @OneToOne(() => Guest, (guest) => guest.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guest_id', foreignKeyConstraintName: 'FK_guest_password_guest_id' })
  guest: Guest;
}
