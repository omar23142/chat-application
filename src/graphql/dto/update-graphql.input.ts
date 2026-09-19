import { UserDto } from './userDto';
import { InputType, Field, Int, PartialType } from '@nestjs/graphql';

@InputType()
export class UpdateGraphqlInput extends PartialType(UserDto) {
  @Field(() => Int)
  id: number;
}