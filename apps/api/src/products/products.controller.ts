import { Body, Controller, Get, HttpCode, Inject, Param, ParseIntPipe, Post } from '@nestjs/common';
import { AvailabilityDto } from './dto/availability.dto';
import { ProductDetail, ProductsService, ProductSummary } from './products.service';

/** FR-01, FR-03: menu và chi tiết sản phẩm (công khai, không cần đăng nhập). */
@Controller('products')
export class ProductsController {
  constructor(@Inject(ProductsService) private readonly products: ProductsService) {}

  @Get()
  findAll(): Promise<ProductSummary[]> {
    return this.products.findAll();
  }

  /** POST /products/availability: số ly tối đa từng dòng theo size, topping và cả giỏ hàng (công khai). */
  @Post('availability')
  @HttpCode(200)
  availability(@Body() dto: AvailabilityDto) {
    return this.products.availability(dto.items);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ProductDetail> {
    return this.products.findOne(id);
  }
}
