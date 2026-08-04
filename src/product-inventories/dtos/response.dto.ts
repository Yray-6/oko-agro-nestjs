import { ApiProperty } from "@nestjs/swagger";
import { ApiResponseDto } from "src/common/dto/api-response.dto";
import { ProductInventory } from "../entities/product-inventory.entity";

export class InventoriesPaginationData {
    @ApiProperty({ type: () => [ProductInventory] })
    items: ProductInventory[];

    @ApiProperty({ example: 1000 })
    totalRecord: number;

    @ApiProperty({ example: 1 })
    pageNumber: number;

    @ApiProperty({ example: 20 })
    pageSize: number;
}

export class GetInventoriesResponseDto extends ApiResponseDto<InventoriesPaginationData> {
    @ApiProperty({ example: 'Inventories fetched successfully' })
    declare message: string;

    @ApiProperty({ type: () => InventoriesPaginationData })
    declare data: InventoriesPaginationData;
}

export class GetProductInventoriesResponseDto extends ApiResponseDto<ProductInventory[]> {
    @ApiProperty({ example: 'Product inventory logs fetched successfully' })
    declare message: string;

    @ApiProperty({ type: () => [ProductInventory] })
    declare data: ProductInventory[];
}
