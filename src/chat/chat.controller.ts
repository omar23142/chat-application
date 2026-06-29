import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PrivateChatService } from './private-chat.service';
import { ProtectGard } from '../users/guards/Protect.guard';
import { GetCurrentUser } from '../users/decorators/current-user.decorator';
import { User } from '../users/entity/User.entity';

@Controller('api/v1/chat')
@UseGuards(ProtectGard)
export class ChatController {
  constructor(private readonly privateChatService: PrivateChatService) {}

  // جلب سجل رسائل غرفة دائمة (مع ترقيم صفحات عبر cursor)
  @Get(':roomId/history')
  async getHistory(
    @Param('roomId', ParseIntPipe) roomId: number,
    @GetCurrentUser() user: User,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.privateChatService.getHistory(
      roomId,
      user.id,
      cursor ? new Date(cursor) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  // عدد الرسائل غير المقروءة في غرفة دائمة
  @Get(':roomId/unread')
  async getUnreadCount(
    @Param('roomId', ParseIntPipe) roomId: number,
    @GetCurrentUser() user: User,
  ) {
    const count = await this.privateChatService.getUnreadCount(roomId, user.id);
    return { roomId, unreadCount: count };
  }
}
