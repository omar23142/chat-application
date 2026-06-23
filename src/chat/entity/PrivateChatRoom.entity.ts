import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from 'src/users/entity/User.entity';
import { PrivateMessage } from './PrivateMessage.entity';

@Entity('PrivateChatRoom')
export class PrivateChatRoom {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  maleId: number;

  @Column()
  femaleId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'maleId' })
  male: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'femaleId' })
  female: User;

  @CreateDateColumn()
  matchedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => PrivateMessage, (msg) => msg.room)
  messages: PrivateMessage[];
}