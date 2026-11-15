import { Body, Controller, Headers, Inject, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  /**
   * POST /payments, header bắt buộc "Idempotency-Key".
   * 201: lần đầu xử lý (status SUCCESS hoặc FAILED). 200 + "Idempotent-Replayed: true": gửi lại cùng khóa.
   * Thử lại sau khi thất bại phải dùng khóa mới.
   */
  @Post()
  async pay(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePaymentDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { result, replayed } = await this.payments.pay(user, dto, idempotencyKey);
    res.status(replayed ? 200 : 201);
    res.setHeader('Idempotent-Replayed', String(replayed));
    return result;
  }
}
