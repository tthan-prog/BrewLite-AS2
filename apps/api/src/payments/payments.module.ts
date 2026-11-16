import { Module } from '@nestjs/common';
import { MockPaymentGateway, PAYMENT_GATEWAY } from './payment-gateway';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { QrPaymentsController } from './qr-payments.controller';
import { QrPaymentsService } from './qr-payments.service';
import { VnpayController } from './vnpay/vnpay.controller';
import { VnpayService } from './vnpay/vnpay.service';

@Module({
  controllers: [PaymentsController, QrPaymentsController, VnpayController],
  providers: [PaymentsService, QrPaymentsService, VnpayService, { provide: PAYMENT_GATEWAY, useClass: MockPaymentGateway }],
})
export class PaymentsModule {}
