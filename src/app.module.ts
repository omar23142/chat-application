import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
// import { ChatGateway } from './chat/chat.gateway';
import { JwtModule, JwtModuleOptions, JwtService } from '@nestjs/jwt';
import { UsersModule } from './users/users.module';
// import { UploadsModule } from './Uploads/Uploads.Module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { User } from './users/entity/User.entity';
import { PrivateChatRoom } from './chat/entity/PrivateChatRoom.entity';
import { PrivateMessage } from './chat/entity/PrivateMessage.entity';
import { Authgateway } from './chat/ChatAuth.gateway';
import { RoomManger } from './chat/room-manager.service';
import { PrivateChatService } from './chat/private-chat.service';
import { ChatController } from './chat/chat.controller';

console.log('MAIN', process.env.NODE_ENV);
@Module({
  imports: [
    UsersModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'production'
          ? `.env.${process.env.NODE_ENV}`
          : '.env',
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // console.log('this is test', config.get<string>('JWT_SECRET_KEY'));
        //  if (!config.get<string>("JWT_EXPIRES_IN"))
        //      throw new error('the jwt is undifined')
        //  let x:string = `${config.get<string>("JWT_EXPIRES_IN")}`
        //  let y:number= parseInt(x)
        return {
          global: true,
          secret: config.get<string>('JWT_SECRET_KEY'),
          signOptions: {
            expiresIn: config.get<string>('JWT_EXPIRES_IN'),
          },
        } as JwtModuleOptions;
      },
    }),
    // local Data Base
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dbUsername = config.get<string>('DB_username');
        const dbpass = config.get<string>('DB_password');
        const database = config.get<string>('DB_database');
        const type = config.get<string>('DB_type');
        const port = config.get<string>('DB_port');
        // console.log('dddddddd', dbUsername, dbpass, database, type, port);
        return {
          database: database,
          type: type,
          username: dbUsername,
          password: dbpass,
          host: 'localhost',
          synchronize: process.env.NODE_ENV !== 'production',
          //dropSchema: true,
          entities: [User, PrivateChatRoom, PrivateMessage],
          port: port,
        } as TypeOrmModuleOptions;
      },
    }),

    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 10000, limit: 10 }],
    }),
    TypeOrmModule.forFeature([User, PrivateChatRoom, PrivateMessage]),
  ],
  controllers: [AppController, ChatController],
  providers: [AppService, Authgateway, RoomManger, PrivateChatService],
})
export class AppModule {}
