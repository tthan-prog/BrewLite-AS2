import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { OrderItemDto } from '../../orders/dto/create-order.dto';

/** POST /products/availability: các dòng giỏ hàng cần kiểm tra (cùng định dạng dòng của POST /orders). */
export class AvailabilityDto {
  @IsArray({ message: 'items phải là mảng' })
  @ArrayMinSize(1, { message: 'Giỏ hàng đang trống' })
  @ArrayMaxSize(20, { message: 'Tối đa 20 dòng mỗi đơn' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}
