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
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { User } from './users/entity/User.entity';
import { PrivateChatRoom } from './chat/entity/PrivateChatRoom.entity';
import { PrivateMessage } from './chat/entity/PrivateMessage.entity';
import { ChatModule } from './chat/chat.module';
import { AuthModule } from './auth/auth.module';
import { PasskeyModule } from './auth/strategy/passkey/passkey.module';
import { Passkey } from './auth/strategy/passkey/entity/passkey.entity';
import { GraphqlModule } from './graphql/graphql.module';
import { GqlThrottlerGuard } from './graphql/Guards/gql-throttler.guard';
import { CacheInterceptor, CacheModule, CacheOptions } from '@nestjs/cache-manager';
import KeyvRedis, { createKeyv } from '@keyv/redis';
import Keyv from 'keyv';
import { KeyvCacheableMemory } from 'cacheable';
import { IntegerType } from 'typeorm/driver/mongodb/typings.js';


console.log('MAIN', process.env.NODE_ENV);

@Module({
  imports: [
    // CacheModule.register({
    //   isGlobal: true,
    //   ttl: 30 * 1000, 
    // }),
    
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (ConfigService: ConfigService) => {
        console.log( Number(ConfigService.get<Number>('Default_CACHE_TTL')));
        console.log( Number(ConfigService.get<Number>('RAM_CACHE_TTL')));
        console.log( Number(ConfigService.get<Number>('Redis_CACHE_TTL')));

        return {
          ttl:  Number(ConfigService.get<Number>('Default_CACHE_TTL')),
          stores: [
            // المخزن الأول: الذاكرة العشوائية RAM
            new Keyv({
              store: new KeyvCacheableMemory({
                ttl: Number(ConfigService.get<Number>('RAM_CACHE_TTL')),
                lruSize: 5000,
              }), 
            }),
            createKeyv(ConfigService.get<string>('Redis_URL')),
            
          ],
        } as CacheOptions<{ ttl: number; stores: Keyv<any>[]; }>;
      },
    }),
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
    // GraphqlModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: GqlThrottlerGuard },
    // {
    //   provide: APP_INTERCEPTOR, // توجيه NestJS لتطبيق هذا المعتترض عاماً
    //   useClass: CacheInterceptor, // تحديد كلاس التخزين المؤقت  use the cachInterceptor for all routes (for all GET endpoints)
    // },
    AppService,
  ],
})
export class AppModule {}
