import { InputType, Int, Field } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUrl, Length } from 'class-validator';

@InputType()
export class UserDto {
    @Field( { description: 'user email' })
    @IsEmail()
    @IsNotEmpty()
    @Length(5, 250)
    email: string;
    @Field( { description: 'user name', nullable: true })
    @IsString()
    @Length(2, 150)
    @IsOptional()
    userName?: string;
    @Field( { description: 'user password' })
    @IsString()
    @IsNotEmpty()
    @Length(8, 250)
    password: string;
    @Field( { description: 'password confirm' })
    @IsString()
    @IsNotEmpty()
    @Length(8, 250)
    passwordConf: string;
    @Field( { description: 'user photo' })
    @IsUrl()
    @IsOptional()
    photo?: string;
    @Field( { description: 'user nativeLanguage' })
    @IsString()
    @IsNotEmpty()
    @Length(2, 150)
    nativeLanguage: string;
    @Field( { description: 'user gender' })
    @IsString()
    @IsNotEmpty()
    @Length(2, 150)
    gender: string;
}