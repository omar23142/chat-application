import { Controller, Get, Header } from '@nestjs/common';
import { AppService } from './app.service';
import { readFileSync } from 'fs';
import { join } from 'path';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('/passkey-test')
  @Header('Content-Type', 'text/html')
  getPasskeyTestPage(): string {
    const htmlPath = join(process.cwd(), 'test-passkey.html');
    return readFileSync(htmlPath, 'utf8');
  }
}
