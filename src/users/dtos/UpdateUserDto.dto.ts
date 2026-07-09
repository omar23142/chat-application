import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Length,
} from 'class-validator';
import { isDeepStrictEqual } from 'util';

export class UpdateUserDto {
  @IsEmail()
  @Length(5, 250)
  @IsOptional()
  email?: string;
  @IsString()
  @Length(2, 150)
  @IsOptional()
  userName?: string;
  @IsOptional() @IsString() nativeLanguage?: string;
  @IsOptional() @IsString() gender?: string;
  @IsUrl()
  @IsOptional()
  photo?: string;
}
