import { Controller, Get, HttpCode, Inject, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RewardsService } from './rewards.service';

@Controller('rewards')
export class RewardsController {
  constructor(@Inject(RewardsService) private readonly rewards: RewardsService) {}

  /** GET /rewards: danh sách quà đang mở (công khai). */
  @Get()
  list() {
    return this.rewards.list();
  }

  /** GET /rewards/me: các mã quà tôi đã đổi. */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: AuthUser) {
    return this.rewards.myRedemptions(user.id);
  }

  /** POST /rewards/:id/redeem: đủ điểm thì trừ điểm và trả mã quà; không đủ trả 400. */
  @Post(':id/redeem')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard)
  redeem(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.rewards.redeem(user.id, id);
  }
}
