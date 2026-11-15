import { Module } from '@nestjs/common';
import { MockPaymentGateway, PAYMENT_GATEWAY } from './payment-gateway';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, { provide: PAYMENT_GATEWAY, useClass: MockPaymentGateway }],
})
export class PaymentsModule {}
