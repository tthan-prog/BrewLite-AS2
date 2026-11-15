import { Body, Controller, Get, HttpCode, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConfirmQrDto, CreateQrDto } from './dto/qr.dto';
import { QrPaymentsService } from './qr-payments.service';

@Controller('payments/qr')
export class QrPaymentsController {
  constructor(@Inject(QrPaymentsService) private readonly qr: QrPaymentsService) {}

  /** POST /payments/qr: khách tạo mã QR cho đơn của mình (201). */
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateQrDto) {
    return this.qr.create(user, dto.orderId);
  }

  /** GET /payments/qr/:token/status: khách hỏi trạng thái QR của đơn mình. */
  @Get(':token/status')
  @UseGuards(JwtAuthGuard)
  status(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.qr.statusForOwner(user, token);
  }

  /** GET /payments/qr/:token: trang xác nhận trên điện thoại (công khai, token khó đoán). */
  @Get(':token')
  view(@Param('token') token: string) {
    return this.qr.view(token);
  }

  /** POST /payments/qr/:token/confirm: chọn tài khoản thử và nhập PIN. */
  @Post(':token/confirm')
  @HttpCode(200)
  confirm(@Param('token') token: string, @Body() dto: ConfirmQrDto) {
    return this.qr.confirm(token, dto.accountIdentifier, dto.pin);
  }
}
