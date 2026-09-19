import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class UserType {
  @Field(() => Int, { description: 'user id' })
  id: number;
  @Field( { description: 'user role' })
  role: string;
  @Field( { nullable:true, description: 'user name' })
  userName: string;
  @Field( { description: 'user email' })
  email: string;
  @Field(() => String, { nullable: true, description: 'user photo' })
  photo: string | null;
  @Field( { description: 'is active' })
  isActive: boolean;
  @Field( { description: 'is verified' })
  isVerified: boolean;
  @Field( { description: 'user native language' })
  nativeLanguage: string;
  @Field( { description: 'user gender' })
  gender: string;
  @Field((type) => Date, { description: 'acount created at' })
  createdAt: Date;
  @Field((type) => Date, { description: 'user information updated at' })
  updatedAt: Date;
  @Field((type) => Date, {nullable:true, description: 'deleted at' })
  deletedAt: Date | null;
  @Field( { description: 'user state' })
  isOnline: boolean;
  @Field((type) => Date, {nullable:true, description: 'user last seen ' })
  lastSeen: Date | null;
}