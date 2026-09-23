import { Field, InputType } from '@nestjs/graphql';
import {
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

@InputType()
export class ChangPassDto {
  @Field()
  @IsNotEmpty()
  @IsString()
  currentPassword!: string;
  @Field()
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  newPassword!: string;
  @Field()
  @IsNotEmpty()
  @IsString()
  newPasswordConfirm!: string;
}