import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class MutationResult {
@Field((type)=> Int)
statue!: number
@Field()
message!: string
}