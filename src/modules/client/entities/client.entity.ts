import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  companyName: string;

  @Column({ unique: true })
  email: string;

  @Column()
  contactPerson: string;

  @Column()
  phone: string;

  @OneToMany(() => User, (user) => user.client)
  users: User[];

  @CreateDateColumn()
  createdAt: Date;
}
