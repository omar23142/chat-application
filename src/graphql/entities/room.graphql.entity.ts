import { Field, Int, ObjectType } from "@nestjs/graphql";
import { UserType } from "./user.graphql.entity";

@ObjectType() 
export class RoomType {

    @Field(() => Int, { description: 'user id' })
      id: number;
    
      @Field(() => Int, { description: 'user id' })
      maleId: number;
    
      @Field(() => Int, { description: 'user id' })
      femaleId: number;
    
      @Field(() => UserType, { description: 'user id' })
      male: UserType;
    
     @Field(() => UserType, { description: 'user id' })
      female: UserType;
    
      @Field(() => Date, { description: 'user id' })
      matchedAt: Date;
    
      @Field(() => Date, { description: 'user id' })
      createdAt: Date;
}