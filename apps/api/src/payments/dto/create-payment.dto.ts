import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, Matches, Min, ValidateIf } from 'class-validator';
import { GatewayMethod } from '../payment-gateway';

export class CreatePaymentDto {
  @IsInt({ message: 'orderId phải là số nguyên' })
  @Min(1, { message: 'orderId không hợp lệ' })
  orderId!: number;

  @IsIn(['WALLET', 'CARD'], { message: 'Phương thức phải là WALLET hoặc CARD' })
  method!: GatewayMethod;

  /** Bắt buộc khi method = CARD. Khoảng trắng được bỏ đi. */
  @ValidateIf((o: CreatePaymentDto) => o.method === 'CARD')
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s+/g, '') : value))
  @IsNotEmpty({ message: 'Vui lòng nhập số thẻ' })
  @Matches(/^\d{12,19}$/, { message: 'Số thẻ gồm 12 đến 19 chữ số' })
  cardNumber?: string;
}
