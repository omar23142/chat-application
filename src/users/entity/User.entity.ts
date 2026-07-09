import { Exclude } from 'class-transformer';
import { CURENT_TIME_STAMP } from '../../utils/constants';
import { userType } from '../../utils/enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
// import { Video } from 'src/videos/entities/video.entity';
// import { Lists } from '../../lists/entities/list.entity';

// import { Vocabulary } from 'src/vocabulary/entities/vocabulary.entity';

@Entity('Users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;
  @Column({ type: 'enum', enum: userType, default: userType.NORMAL_USER })
  role: string;
  @Column({ type: 'varchar', length: 150, nullable: true, unique: true })
  userName: string;
  @Column({ type: 'varchar', length: 250, nullable: false, unique: true })
  email: string;
  @Column({ nullable: false, select: true })
  @Exclude()
  password: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  photo: string | null;
  @Column({ default: true })
  isActive: boolean;
  @Column({ default: false })
  isVerified: boolean;
  @Column({ type: 'varchar', nullable: true, default: null })
  verificationToken: string | null;
  @Column({ type: 'varchar', nullable: true, default: null })
  ResetPassToken: string | null;
  @Column({ type: 'timestamptz', nullable: true, default: null })
  ResetPassTokenExpires: Date | null;
  @Column({ type: 'timestamptz', nullable: true, default: null })
  passwordUpdatedAt: Date | null;
  @Column({
    type: 'varchar',
    nullable: false, //default: 'ar'
  })
  nativeLanguage: string;
  @Column({
    type: 'varchar',
    nullable: false,
  })
  gender: string;
  @CreateDateColumn({ type: 'timestamp', default: () => CURENT_TIME_STAMP })
  createdAt: Date;
  @UpdateDateColumn({
    type: 'timestamp',
    default: () => CURENT_TIME_STAMP,
    onUpdate: CURENT_TIME_STAMP,
  })
  updatedAt: Date;

  @Column({ type: 'boolean', default: false })
  isOnline: boolean;

  @Column({ type: 'varchar', nullable: true })
  socketId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeen: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
