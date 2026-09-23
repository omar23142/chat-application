import { UserDto } from './userDto';
import { InputType, Field, Int, PartialType, OmitType } from '@nestjs/graphql';

@InputType()
export class UpdateUserDto extends PartialType(OmitType(UserDto, ['password', 'passwordConf'] as const),) {
  

}