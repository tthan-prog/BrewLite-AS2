import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser } from '../../auth/auth-user';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CreateQrDto } from '../dto/qr.dto';
import { VnpayService } from './vnpay.service';

/** IP của khách: header X-Forwarded-For (Render đứng trước API) rồi đến địa chỉ kết nối. */
function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  const ip = first || req.socket.remoteAddress || '127.0.0.1';
  return ip.replace(/^::ffff:/, '');
}

@Controller('payments/vnpay')
export class VnpayController {
  constructor(@Inject(VnpayService) private readonly vnpay: VnpayService) {}

  /** GET /payments/vnpay/config: giao diện biết VNPay đã bật hay chưa. */
  @Get('config')
  config() {
    return { enabled: this.vnpay.settings !== null };
  }

  /** POST /payments/vnpay (đăng nhập): tạo URL thanh toán VNPay sandbox cho đơn của mình. */
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateQrDto, @Req() req: Request) {
    return this.vnpay.create(user, dto.orderId, clientIp(req));
  }

  /**
   * GET /payments/vnpay/return?vnp_...: trang /checkout/vnpay-return chuyển nguyên chuỗi query về đây.
   * Sai chữ ký hoặc sai số tiền trả 400, đơn giữ nguyên trạng thái.
   */
  @Get('return')
  async handleReturn(@Query() query: Record<string, unknown>) {
    const outcome = await this.vnpay.process(query);
    switch (outcome.kind) {
      case 'paid':
      case 'failed':
        return outcome.result;
      case 'invalid-signature':
        throw new BadRequestException('Chữ ký VNPay không hợp lệ');
      case 'invalid-amount':
        throw new BadRequestException('Số tiền giao dịch không khớp với đơn hàng');
      case 'not-found':
        throw new NotFoundException('Không tìm thấy giao dịch');
      case 'already-confirmed':
        throw new BadRequestException('Giao dịch đã được xác nhận trước đó');
    }
  }

  /** GET /payments/vnpay/ipn: VNPay gọi máy chủ–máy chủ; trả RspCode theo tài liệu VNPay. */
  @Get('ipn')
  async ipn(@Query() query: Record<string, unknown>) {
    let outcome;
    try {
      outcome = await this.vnpay.process(query);
    } catch {
      // Ví dụ: đơn đã được thanh toán bằng phương thức khác hoặc đã bị hủy
      return { RspCode: '02', Message: 'Order already confirmed' };
    }
    switch (outcome.kind) {
      case 'paid':
      case 'failed':
        return { RspCode: '00', Message: 'Confirm Success' };
      case 'invalid-signature':
        return { RspCode: '97', Message: 'Invalid signature' };
      case 'not-found':
        return { RspCode: '01', Message: 'Order not found' };
      case 'invalid-amount':
        return { RspCode: '04', Message: 'Invalid amount' };
      case 'already-confirmed':
        return { RspCode: '02', Message: 'Order already confirmed' };
    }
  }
}
