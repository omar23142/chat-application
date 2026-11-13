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
import {
  CacheInterceptor,
  CacheModule,
  CacheOptions,
} from '@nestjs/cache-manager';
import KeyvRedis, { createKeyv } from '@keyv/redis';
import Keyv from 'keyv';
import { KeyvCacheableMemory } from 'cacheable';
import { WinstonModule } from 'nest-winston';
import logger from '../winston/winston';
import { IntegerType } from 'typeorm/driver/mongodb/typings.js';
import { Injectable, Logger } from '@nestjs/common';

Logger.flush();
Logger.error('this is default');
Logger.debug('hello');
Logger.log('ddddddd', 'from appModule');
Logger.warn('dddd');
Logger.detachBuffer();
console.log('MAIN', process.env.NODE_ENV);
logger.warn('hellow from the apppppppppp module');
logger.error('this is emergenchy');
@Module({
  imports: [
    // CacheModule.register({
    //   isGlobal: true,
    //   ttl: 30 * 1000,
    // }),
    // WinstonModule.forRoot(winstonConfig),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (ConfigService: ConfigService) => {
        console.log(Number(ConfigService.get<number>('Default_CACHE_TTL')));
        console.log(Number(ConfigService.get<number>('RAM_CACHE_TTL')));
        console.log(Number(ConfigService.get<number>('Redis_CACHE_TTL')));

        return {
          ttl: Number(ConfigService.get<number>('Default_CACHE_TTL')),
          stores: [
            // المخزن الأول: الذاكرة العشوائية RAM
            new Keyv({
              store: new KeyvCacheableMemory({
                ttl: Number(ConfigService.get<number>('RAM_CACHE_TTL')),
                lruSize: 5000,
              }),
            }),
            createKeyv(ConfigService.get<string>('Redis_URL')),
          ],
        } as CacheOptions<{ ttl: number; stores: Keyv<any>[] }>;
      },
    }),
    UsersModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'production'
          ? '.env'
          : process.env.NODE_ENV === 'development'
            ? '.env.development'
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
            : process.env.NODE_ENV === 'development_docker'
              ? config.get<string>('DOCKER_DEV_DB_username')
              : config.get<string>('DB_username');
        const dbpass =
          process.env.NODE_ENV === 'test'
            ? config.get<string>('DB_password_test')
            : process.env.NODE_ENV === 'development_docker'
              ? config.get<string>('DOCKER_DEV_DB_password')
              : config.get<string>('DB_password');
        const database =
          process.env.NODE_ENV === 'test'
            ? config.get<string>('DB_database_test')
            : process.env.NODE_ENV === 'development_docker'
              ? config.get<string>('DOCKER_DEV_DB_database')
              : config.get<string>('DB_database');
        const type =
          process.env.NODE_ENV === 'test'
            ? config.get<string>('DB_type_test')
            : process.env.NODE_ENV === 'development_docker'
              ? config.get<string>('DOCKER_DEV_DB_type')
              : config.get<string>('DB_type');
        const port =
          process.env.NODE_ENV === 'test'
            ? config.get<string>('DB_port_test')
            : process.env.NODE_ENV === 'development_docker'
              ? config.get<string>('DOCKER_DEV_DB_port')
              : config.get<string>('DB_port');
        const host =
          process.env.NODE_ENV === 'test'
            ? config.get<string>('DB_host_test')
            : process.env.NODE_ENV === 'development_docker'
              ? config.get<string>('DOCKER_DEV_DB_host')
              : config.get<string>('DB_host');
        // console.log('dddddddd', dbUsername, dbpass, database, type, port);
        if (process.env.NODE_ENV !== 'production') {
          return {
            database,
            type,
            username: dbUsername,
            password: dbpass,
            host,
            synchronize: process.env.NODE_ENV !== 'production',
            //dropSchema: true,
            entities: [User, PrivateChatRoom, PrivateMessage, Passkey],
            port,
          } as TypeOrmModuleOptions;
        }
        return {
          type: 'postgres',
          url: config.get<string>('DB_URL'),
          ssl: {
            rejectUnauthorized: false, // تسمح بالاتصال الآمن بدون تعقيد شهادات الـ SSL المحلية
          },
          synchronize: process.env.NODE_ENV !== 'production',
          entities: [User, PrivateChatRoom, PrivateMessage, Passkey],
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
