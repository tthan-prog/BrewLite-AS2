import { OrderStatus } from '@prisma/client';
import { IsIn, IsOptional } from 'class-validator';
import { STAFF_TARGET_STATUSES, StaffTargetStatus } from '../order-status';

export class UpdateOrderStatusDto {
  @IsIn([...STAFF_TARGET_STATUSES], { message: 'Trạng thái phải là PREPARING, READY, COMPLETED hoặc CANCELLED' })
  status!: StaffTargetStatus;
}

export class ListOrdersQueryDto {
  @IsOptional()
  @IsIn(Object.values(OrderStatus), { message: 'Trạng thái không hợp lệ' })
  status?: OrderStatus;
}
