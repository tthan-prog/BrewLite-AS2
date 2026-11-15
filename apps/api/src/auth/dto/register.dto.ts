import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Đăng ký tài khoản khách hàng (FR-05). Không nhận trường role: luôn là CUSTOMER. */
export class RegisterDto {
  @Transform(trim)
  @IsString({ message: 'Họ tên phải là chuỗi' })
  @Length(1, 100, { message: 'Họ tên dài từ 1 đến 100 ký tự' })
  name!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;

  @IsString({ message: 'Mật khẩu phải là chuỗi' })
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  // bcrypt chỉ dùng 72 byte đầu
  @MaxLength(72, { message: 'Mật khẩu tối đa 72 ký tự' })
  password!: string;
}
