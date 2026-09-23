import { ObjectType, Field, Int } from '@nestjs/graphql';
import { UserType } from './user.graphql.entity';
import { RoomType } from './room.graphql.entity';

@ObjectType()
export class MessageType {
  @Field(() => Int)
  id!: number;
  @Field(() => RoomType , {nullable: true})
  room!: RoomType;
  @Field(() => Int)
  roomId!: number;
  @Field(() => UserType , {nullable: true})
  sender!: UserType;
  @Field(() => Int)
  senderId!: number;

  @Field()
  content!: string;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date, {nullable: true})
  readAt?: Date | null;

  @Field(() => Date, {nullable: true})
  deletedAt?: Date | null;
  
}
