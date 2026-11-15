import { Module } from '@nestjs/common';
import { MockPaymentGateway, PAYMENT_GATEWAY } from './payment-gateway';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { QrPaymentsController } from './qr-payments.controller';
import { QrPaymentsService } from './qr-payments.service';

@Module({
  controllers: [PaymentsController, QrPaymentsController],
  providers: [PaymentsService, QrPaymentsService, { provide: PAYMENT_GATEWAY, useClass: MockPaymentGateway }],
})
export class PaymentsModule {}
