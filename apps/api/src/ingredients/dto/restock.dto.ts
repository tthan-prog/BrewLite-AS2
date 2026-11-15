import { IsInt, Max, Min } from 'class-validator';

export class RestockDto {
  @IsInt({ message: 'Số lượng nhập phải là số nguyên' })
  @Min(1, { message: 'Số lượng nhập phải dương' })
  @Max(1_000_000, { message: 'Số lượng nhập tối đa 1.000.000 mỗi lần' })
  quantity!: number;
}
