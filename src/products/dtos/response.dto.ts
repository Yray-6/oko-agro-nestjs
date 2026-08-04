import { ApiProperty } from "@nestjs/swagger";
import { ApiResponseDto } from "src/common/dto/api-response.dto";
import { Product } from "../entities/product.entity";
import { FarmerProductPhotoFile } from "src/farmer-product-photo-files/entities/farmer-product-photo-file.entity";

export class ProductPaginationData {
    @ApiProperty({ type: () => [Product] })
    items: Product[];

    @ApiProperty({ example: 1000 })
    totalRecord: number;

    @ApiProperty({ example: 1 })
    pageNumber: number;

    @ApiProperty({ example: 20 })
    pageSize: number;
}

export class ProductCreateResponseDto extends ApiResponseDto<Product> {
    @ApiProperty({ example: 201 })
    declare statusCode: number;

    @ApiProperty({ example: 'Product created successfully!' })
    declare message: string;

    @ApiProperty({ type: () => Product })
    declare data: Product;
}

export class ProductUpdateResponseDto extends ApiResponseDto<Product> {
    @ApiProperty({ example: 'Product updated successfully!' })
    declare message: string;

    @ApiProperty({ type: () => Product })
    declare data: Product;
}

export class ProductFindResponseDto extends ApiResponseDto<Product> {
    @ApiProperty({ example: 'Product fetched successfully' })
    declare message: string;

    @ApiProperty({ type: () => Product })
    declare data: Product;
}

export class ProductDeleteResponseDto extends ApiResponseDto<undefined> {
    @ApiProperty({ example: 'Product deleted successfully' })
    declare message: string;
}

export class ProductPhotosUploadResponseDto extends ApiResponseDto<FarmerProductPhotoFile[]> {
    @ApiProperty({ example: 201 })
    declare statusCode: number;

    @ApiProperty({ example: 'Product photos uploaded successfully!' })
    declare message: string;

    @ApiProperty({ type: () => [FarmerProductPhotoFile] })
    declare data: FarmerProductPhotoFile[];
}

export class ProductPhotoDeleteResponseDto extends ApiResponseDto<undefined> {
    @ApiProperty({ example: 'Farmer product photo file deleted successfully!' })
    declare message: string;
}

export class ProductApprovalStatusResponseDto extends ApiResponseDto<Product> {
    @ApiProperty({ example: 'Product approved successfully' })
    declare message: string;

    @ApiProperty({ type: () => Product })
    declare data: Product;
}

export class ProductListingsResponseDto extends ApiResponseDto<ProductPaginationData> {
    @ApiProperty({ example: 'Product listings fetched successfully' })
    declare message: string;

    @ApiProperty({ type: () => ProductPaginationData })
    declare data: ProductPaginationData;
}

export class ProductFindByUserIdResponseDto extends ApiResponseDto<Product[]> {
    @ApiProperty({ example: 'User product(s) fetched successfully' })
    declare message: string;

    @ApiProperty({ type: () => [Product] })
    declare data: Product[];
}

export class ProductApprovedFindByUserIdResponseDto extends ApiResponseDto<Product[]> {
    @ApiProperty({ example: 'Approved product(s) fetched successfully' })
    declare message: string;

    @ApiProperty({ type: () => [Product] })
    declare data: Product[];
}
