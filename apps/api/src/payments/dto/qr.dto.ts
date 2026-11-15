import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Matches, Min } from 'class-validator';

export class CreateQrDto {
  @IsInt({ message: 'orderId phải là số nguyên' })
  @Min(1, { message: 'orderId không hợp lệ' })
  orderId!: number;
}

export class ConfirmQrDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString({ message: 'Vui lòng chọn tài khoản' })
  @Length(1, 50, { message: 'Tài khoản không hợp lệ' })
  accountIdentifier!: string;

  @IsString({ message: 'Vui lòng nhập PIN' })
  @Matches(/^\d{6}$/, { message: 'PIN gồm 6 chữ số' })
  pin!: string;
}
