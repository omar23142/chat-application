import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1794566323872 implements MigrationInterface {
    name = 'Migration1794566323872'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "PrivateMessage" ("id" SERIAL NOT NULL, "roomId" integer NOT NULL, "senderId" integer NOT NULL, "content" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "readAt" TIMESTAMP WITH TIME ZONE, "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_ce86e05ec1797749a795d875443" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "PrivateMessage" ADD CONSTRAINT "FK_a0065cbd7253fc4fab998d44851" FOREIGN KEY ("roomId") REFERENCES "PrivateChatRoom"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "PrivateMessage" ADD CONSTRAINT "FK_397d678abde20ae398fd434d187" FOREIGN KEY ("senderId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "PrivateMessage" DROP CONSTRAINT "FK_397d678abde20ae398fd434d187"`);
        await queryRunner.query(`ALTER TABLE "PrivateMessage" DROP CONSTRAINT "FK_a0065cbd7253fc4fab998d44851"`);
        await queryRunner.query(`DROP TABLE "PrivateMessage"`);
    }

}
