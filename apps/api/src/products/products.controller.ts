import { Inject, Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ProductDetail, ProductsService, ProductSummary } from './products.service';

/** FR-01, FR-03: menu và chi tiết sản phẩm (công khai, không cần đăng nhập). */
@Controller('products')
export class ProductsController {
  constructor(@Inject(ProductsService) private readonly products: ProductsService) {}

  @Get()
  findAll(): Promise<ProductSummary[]> {
    return this.products.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ProductDetail> {
    return this.products.findOne(id);
  }
}
