import 'tsconfig-paths/register';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '/home/omaralm/Projects/chat-application/src/users/entity/User.entity';
import { PrivateChatRoom } from '/home/omaralm/Projects/chat-application/src/chat/entity/PrivateChatRoom.entity';
import { PrivateMessage } from '/home/omaralm/Projects/chat-application/src/chat/entity/PrivateMessage.entity';
import { Passkey } from '/home/omaralm/Projects/chat-application/src/auth/strategy/passkey/entity/passkey.entity';
import { Logger } from '@nestjs/common';

ConfigModule.forRoot({
  isGlobal: true,
  envFilePath:
    process.env.NODE_ENV === 'production'
      ? '.env'
      :process.env.NODE_ENV === 'development'
      ? '.env.development'
      :`.env.${process.env.NODE_ENV}`
      ,
});

const configService = new ConfigService();
console.log('__dirname', __dirname);
const dataSourceOptions: DataSourceOptions = {
    type:'postgres',
    url:process.env.DB_URL,
    ssl: {
    rejectUnauthorized: false, // ضروري جداً للاتصال بقاعدة بيانات Neon السحابية
  },
   entities: [User, PrivateChatRoom, PrivateMessage, Passkey],
   migrations: [__dirname + '/migrations/*{.ts,.js}'],
   logging: true,
   synchronize: true, // يجب أن تكون false دائماً عند استخدام Migrations
}
console.log(process.env.NODE_ENV, 'process.env.NODE_ENV');

const AppDataSource = new DataSource({
  
  type: 'postgres',
  host:  process.env.DB_HOST || 'localhost',
  port: parseInt(configService.get('DB_PORT') || '5432', 10),
  username: configService.get('DB_username'),
  password: configService.get('DB_password'),
  database: configService.get('DB_database'),
  // entities: [__dirname + '/**/*.entity{.ts,.js}'],
  entities: [User, PrivateChatRoom, PrivateMessage, Passkey],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: true,
});
// Logger.debug('DataSource Options:', AppDataSource.options);

let dataSource: DataSource;
if (process.env.NODE_ENV === 'production') {
  dataSource = new DataSource(dataSourceOptions);
} else {
  dataSource = AppDataSource;
}

export { dataSource };