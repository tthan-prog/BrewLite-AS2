import { Body, Controller, Get, Inject, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto, UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

/** Mọi route đơn hàng cần đăng nhập (FR-06). */
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly orders: OrdersService) {}

  /** POST /orders: tạo đơn PENDING (201); thiếu nguyên liệu hoặc mã sai trả 400. */
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(user, dto);
  }

  /** GET /orders/me: lịch sử đơn của tôi. */
  @Get('me')
  findMine(@CurrentUser() user: AuthUser) {
    return this.orders.findMine(user.id);
  }

  /** GET /orders?status=PAID: danh sách đơn cho nhân viên. */
  @Get()
  @Roles(Role.STAFF)
  list(@Query() query: ListOrdersQueryDto) {
    return this.orders.listForStaff(query.status);
  }

  /** GET /orders/:id: chi tiết đơn (chủ đơn hoặc STAFF). */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.orders.findOne(id, user);
  }

  /** PATCH /orders/:id/status: chỉ STAFF (CUSTOMER nhận 403). */
  @Patch(':id/status')
  @Roles(Role.STAFF)
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrderStatusDto) {
    return this.orders.updateStatus(id, dto.status);
  }
}
