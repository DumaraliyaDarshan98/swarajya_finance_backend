import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NotificationService } from '../services/notification.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AuthedUser } from '../../../common/interfaces/authed-user.interface';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  list(
    @Req() req: { user: AuthedUser },
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Number(limit) : 50;
    return this.service.listForUser(req.user.sub, Number.isFinite(n) ? n : 50);
  }

  @Get('unread-count')
  unreadCount(@Req() req: { user: AuthedUser }) {
    return this.service.unreadCount(req.user.sub);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @Req() req: { user: AuthedUser }) {
    return this.service.markRead(id, req.user.sub);
  }

  @Post('mark-all-read')
  markAllRead(@Req() req: { user: AuthedUser }) {
    return this.service.markAllRead(req.user.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: { user: AuthedUser }) {
    return this.service.remove(id, req.user.sub);
  }
}
