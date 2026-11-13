import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1794564405493 implements MigrationInterface {
    name = 'Migration1794564405493'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."Users_role_enum" AS ENUM('NORMAL_USER', 'ADMIN')`);
        await queryRunner.query(`CREATE TABLE "Users" ("id" SERIAL NOT NULL, "role" "public"."Users_role_enum" NOT NULL DEFAULT 'NORMAL_USER', "userName" character varying(150), "email" character varying(250) NOT NULL, "password" character varying NOT NULL, "accessTokenVersion" integer NOT NULL DEFAULT '1', "refreshToken" character varying, "photo" character varying, "isActive" boolean NOT NULL DEFAULT true, "isVerified" boolean NOT NULL DEFAULT false, "verificationToken" character varying, "ResetPassToken" character varying, "ResetPassTokenExpires" TIMESTAMP WITH TIME ZONE, "passwordUpdatedAt" TIMESTAMP WITH TIME ZONE, "nativeLanguage" character varying NOT NULL, "gender" character varying NOT NULL, "passkeyChallenge" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, "updatedAt" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, "isOnline" boolean NOT NULL DEFAULT false, "socketId" character varying, "lastSeen" TIMESTAMP WITH TIME ZONE, "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_b2ee401c9d5288def8a87c559a0" UNIQUE ("userName"), CONSTRAINT "UQ_3c3ab3f49a87e6ddb607f3c4945" UNIQUE ("email"), CONSTRAINT "PK_16d4f7d636df336db11d87413e3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "PrivateMessage" ("id" SERIAL NOT NULL, "roomId" integer NOT NULL, "senderId" integer NOT NULL, "content" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "readAt" TIMESTAMP WITH TIME ZONE, "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_ce86e05ec1797749a795d875443" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "PrivateChatRoom" ("id" SERIAL NOT NULL, "maleId" integer NOT NULL, "femaleId" integer NOT NULL, "matchedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_87398e6c404537964f54f88ac76" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "Passkeys" ("id" SERIAL NOT NULL, "credentialId" character varying NOT NULL, "publicKey" bytea NOT NULL, "counter" integer NOT NULL DEFAULT '0', "userId" integer, CONSTRAINT "UQ_47d2945fa8fada8ea4728c12943" UNIQUE ("credentialId"), CONSTRAINT "PK_353927f1cd95f025eebb6c9c8e6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "PrivateMessage" ADD CONSTRAINT "FK_a0065cbd7253fc4fab998d44851" FOREIGN KEY ("roomId") REFERENCES "PrivateChatRoom"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "PrivateMessage" ADD CONSTRAINT "FK_397d678abde20ae398fd434d187" FOREIGN KEY ("senderId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "PrivateChatRoom" ADD CONSTRAINT "FK_9dde3ad8b6c9b85f4d416f0d219" FOREIGN KEY ("maleId") REFERENCES "Users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "PrivateChatRoom" ADD CONSTRAINT "FK_07ca56e46de0a10f3d80ab6a584" FOREIGN KEY ("femaleId") REFERENCES "Users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "Passkeys" ADD CONSTRAINT "FK_7dd50a88bff746f358da0b8b48a" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Passkeys" DROP CONSTRAINT "FK_7dd50a88bff746f358da0b8b48a"`);
        await queryRunner.query(`ALTER TABLE "PrivateChatRoom" DROP CONSTRAINT "FK_07ca56e46de0a10f3d80ab6a584"`);
        await queryRunner.query(`ALTER TABLE "PrivateChatRoom" DROP CONSTRAINT "FK_9dde3ad8b6c9b85f4d416f0d219"`);
        await queryRunner.query(`ALTER TABLE "PrivateMessage" DROP CONSTRAINT "FK_397d678abde20ae398fd434d187"`);
        await queryRunner.query(`ALTER TABLE "PrivateMessage" DROP CONSTRAINT "FK_a0065cbd7253fc4fab998d44851"`);
        await queryRunner.query(`DROP TABLE "Passkeys"`);
        await queryRunner.query(`DROP TABLE "PrivateChatRoom"`);
        await queryRunner.query(`DROP TABLE "PrivateMessage"`);
        await queryRunner.query(`DROP TABLE "Users"`);
        await queryRunner.query(`DROP TYPE "public"."Users_role_enum"`);
    }

}
