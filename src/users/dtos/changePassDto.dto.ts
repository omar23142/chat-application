import {
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

export class ChangPassDto {
  @IsNotEmpty()
  @IsString()
  currentPassword!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  newPassword!: string;

  @IsNotEmpty()
  @IsString()
  newPasswordConfirm!: string;
}