import { Module } from '@nestjs/common';
//import { ConfigService } from "@nestjs/config";
// import { MaileConfig } from '../config/MailConfig';
import { MailerModule } from '@nestjs-modules/mailer';
import { EjsAdapter } from '@nestjs-modules/mailer/adapters/ejs.adapter';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { MailService } from './mail.service';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isDevelopmentOrTest =
          process.env.NODE_ENV === 'development' ||
          process.env.NODE_ENV === 'test';

        if (isDevelopmentOrTest) {
          const transport: SMTPTransport.Options = {
            host: config.get<string>('SMTP_HOST'),
            port: Number(config.get<string>('SMTP_PORT')),
            secure: false,
            auth: {
              user: config.get<string>('SMTP_USERNAME'),
              pass: config.get<string>('SMTP_PASSWORD'),
            },
          };

          return {
            transport,
            template: {
              dir: join(__dirname, 'template'),
              adapter: new EjsAdapter(),
            },
          };
        }

        return {
          transport: {
            service: 'SendGrid',
            auth: {
              user: config.get<string>('SENDGRID_USERNAME'),
              pass: config.get<string>('SENDGRID_PASSWORD'),
            },
          },
        };
      },
    }),
  ],
  exports: [MailService],
  controllers: [],
  providers: [MailService],
})
export class MailModule {}
