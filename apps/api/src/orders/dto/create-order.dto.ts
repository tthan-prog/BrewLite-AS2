import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CupSize, MAX_QUANTITY_PER_LINE, SUGAR_ICE_LEVELS } from '../../inventory/recipe-calculator';

const LEVELS = [...SUGAR_ICE_LEVELS];

/** Một dòng giỏ hàng gửi lên khi đặt đơn. Giá không gửi lên: máy chủ tự tính. */
export class OrderItemDto {
  @IsInt({ message: 'productId phải là số nguyên' })
  @Min(1, { message: 'productId không hợp lệ' })
  productId!: number;

  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @Min(1, { message: 'Số lượng tối thiểu là 1' })
  @Max(MAX_QUANTITY_PER_LINE, { message: `Tối đa ${MAX_QUANTITY_PER_LINE} ly mỗi món` })
  quantity!: number;

  @IsOptional()
  @IsIn(['S', 'M', 'L'], { message: 'Size phải là S, M hoặc L' })
  size?: CupSize;

  @IsOptional()
  @IsIn(LEVELS, { message: 'Mức đường phải là 0, 30, 50, 70 hoặc 100' })
  sugar?: number;

  @IsOptional()
  @IsIn(LEVELS, { message: 'Mức đá phải là 0, 30, 50, 70 hoặc 100' })
  ice?: number;

  @IsOptional()
  @IsArray({ message: 'toppingIds phải là mảng' })
  @ArrayMaxSize(5, { message: 'Tối đa 5 topping mỗi ly' })
  @ArrayUnique({ message: 'Topping bị lặp' })
  @IsInt({ each: true, message: 'toppingIds phải là số nguyên' })
  @Min(1, { each: true, message: 'toppingId không hợp lệ' })
  toppingIds?: number[];
}

export class CreateOrderDto {
  @IsArray({ message: 'items phải là mảng' })
  @ArrayMinSize(1, { message: 'Giỏ hàng đang trống' })
  @ArrayMaxSize(20, { message: 'Tối đa 20 dòng mỗi đơn' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString({ message: 'Mã khuyến mãi phải là chuỗi' })
  @Length(1, 32, { message: 'Mã khuyến mãi dài từ 1 đến 32 ký tự' })
  promotionCode?: string;
}
