import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

type MemberExtra = {
    hasThumbnails?:boolean
}

@Entity()
export class Member {

    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        length: 100,
    })
    name: string;

    @Column({
        length: 100,
    })
    email: string;

    @Column('json')
    extra: MemberExtra;

  @CreateDateColumn({ name: 'created_at',
  nullable: false, })
  createdAt: Date;
  
  @UpdateDateColumn({ name: 'updated_at',
  nullable: false, })
  updatedAt: Date;

}
