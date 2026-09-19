import { Field, ObjectType } from "@nestjs/graphql";
import { MessageType } from "./message.graphql.entity";



@ObjectType()
export class messageResponse {
  @Field(() => Boolean)
  hasMore: boolean;

  @Field(() => Date, { nullable: true })
  nextCursor: Date | null;

  @Field(() => [MessageType])
  messages: MessageType[];
}