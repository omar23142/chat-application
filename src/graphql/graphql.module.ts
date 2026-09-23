import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphqlService } from './graphql.service';
import { USERResolver } from './gqlUser.Resolver';
import { join } from 'path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatModule } from 'src/chat/chat.module';
import { UsersModule } from 'src/users/users.module';
import { MailModule } from 'src/mail/mail.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/users/entity/User.entity';
import { messageResponse } from './entities/messageResponse.graphql';
import { MessageResolver } from './message.Resolver';
import { DataLoaderService } from './DataLoader.service';
import { PrivateChatRoom } from 'src/chat/entity/PrivateChatRoom.entity';
import { APP_FILTER } from '@nestjs/core';
import { GqlGlobalExceptionFilter } from './filters/gql-global-exception.filter';

@Module({
   imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/graphql/schema.gql'),
      graphiql: true,
      context: ({ req, res }) => ({ req, res }),
    }),
    UsersModule,
    ChatModule,
    MailModule,
    TypeOrmModule.forFeature([User, PrivateChatRoom])
    
     
  //   GraphQLModule.forRootAsync<ApolloDriverConfig>({
  //     driver: ApolloDriver,
  //     imports: [ConfigModule],
  //     inject: [ConfigService],
  //     useFactory: async (configService: ConfigService) => ({
  //       // typePaths: configService.get<string>('GRAPHQL_TYPE_PATHS'),
  //     }),
      
  // }),

  ],
  providers: [
    USERResolver,
    MessageResolver,
    GraphqlService,
    DataLoaderService,
    { provide: APP_FILTER, useClass: GqlGlobalExceptionFilter },
  ],
})
export class GraphqlModule {}