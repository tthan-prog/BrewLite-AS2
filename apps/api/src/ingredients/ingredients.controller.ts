import { Body, Controller, Get, Inject, Param, ParseIntPipe, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RestockDto } from './dto/restock.dto';
import { IngredientsService } from './ingredients.service';

/** Chỉ STAFF (FR-17); CUSTOMER nhận 403, chưa đăng nhập nhận 401. */
@Controller('ingredients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STAFF)
export class IngredientsController {
  constructor(@Inject(IngredientsService) private readonly ingredients: IngredientsService) {}

  /** GET /ingredients: tồn kho kèm cờ OUT / LOW / OK. */
  @Get()
  list() {
    return this.ingredients.list();
  }

  /** PATCH /ingredients/:id/restock: nhập thêm, số lượng phải dương. */
  @Patch(':id/restock')
  restock(@Param('id', ParseIntPipe) id: number, @Body() dto: RestockDto) {
    return this.ingredients.restock(id, dto.quantity);
  }
}
