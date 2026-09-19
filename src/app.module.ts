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
import { APP_GUARD } from '@nestjs/core';
import { User } from './users/entity/User.entity';
import { PrivateChatRoom } from './chat/entity/PrivateChatRoom.entity';
import { PrivateMessage } from './chat/entity/PrivateMessage.entity';
import { ChatModule } from './chat/chat.module';
import { AuthModule } from './auth/auth.module';
import { PasskeyModule } from './auth/strategy/passkey/passkey.module';
import { Passkey } from './auth/strategy/passkey/entity/passkey.entity';
import { GraphqlModule } from './graphql/graphql.module';
import { GqlThrottlerGuard } from './graphql/Gards/gql-throttler.guard';

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
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return {
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
        const dbUsername =
          process.env.NODE_ENV === 'test'
            ? config.get<string>('DB_username_test')
            : config.get<string>('DB_username');
        const dbpass =
          process.env.NODE_ENV === 'test'
            ? config.get<string>('DB_password_test')
            : config.get<string>('DB_password');
        const database =
          process.env.NODE_ENV === 'test'
            ? config.get<string>('DB_database_test')
            : config.get<string>('DB_database');
        const type =
          process.env.NODE_ENV === 'test'
            ? config.get<string>('DB_type_test')
            : config.get<string>('DB_type');   
        const port =
          process.env.NODE_ENV === 'test'
            ? config.get<string>('DB_port_test')
            : config.get<string>('DB_port');
        // console.log('dddddddd', dbUsername, dbpass, database, type, port);
        return {
          database: database,
          type: type,
          username: dbUsername,
          password: dbpass,
          host: 'localhost',
          synchronize: process.env.NODE_ENV !== 'production',
          //dropSchema: true,
          entities: [User, PrivateChatRoom, PrivateMessage, Passkey],
          port: port,
        } as TypeOrmModuleOptions;
      },
    }),

    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 10000, limit: 10 }],
    }),
    TypeOrmModule.forFeature([User, PrivateChatRoom, PrivateMessage, Passkey]),
    AuthModule,
    PasskeyModule,
    ChatModule,
    GraphqlModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: GqlThrottlerGuard },
    AppService,
  ],
})
export class AppModule {}
