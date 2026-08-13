import { ApiProperty } from "@nestjs/swagger";
import { ApiResponseDto } from "src/common/dto/api-response.dto";
import { BuyRequest } from "../entities/buy-request.entity";
import { PurchaseOrderDocFile } from "src/purchase-order-doc-files/entities/purchase-order-doc-file.entity";

export class BuyRequestPaginationData {
    @ApiProperty({ type: () => [BuyRequest] })
    items: BuyRequest[];

    @ApiProperty({ example: 1000 })
    totalRecord: number;

    @ApiProperty({ example: 1 })
    pageNumber: number;

    @ApiProperty({ example: 20 })
    pageSize: number;
}

export class GetAllBuyRequestsResponseDto extends ApiResponseDto<BuyRequestPaginationData> {
    @ApiProperty({ example: 'Buyrequests fetched successfully' })
    declare message: string;

    @ApiProperty({ type: () => BuyRequestPaginationData })
    declare data: BuyRequestPaginationData;
}

export class DirectBuyRequestResponseData {
    @ApiProperty({ example: "l89vuh-uhohou-gfyrf-5tgygv" })
    id: string;

    @ApiProperty({ example: "l89vuh-uhohou-gfyrf-5tgygv" })
    sellerId: string;
}

export class BuyRequestCreateResponseDto extends ApiResponseDto<BuyRequest> {
    @ApiProperty({ example: 201 })
    declare statusCode: number;

    @ApiProperty({ example: 'BuyRequest created successfully!' })
    declare message: string;

    @ApiProperty({ type: () => BuyRequest })
    declare data: BuyRequest;
}

export class BuyRequestUpdateResponseDto extends ApiResponseDto<BuyRequest> {
    @ApiProperty({ example: 'Buy request updated successfully!' })
    declare message: string;

    @ApiProperty({ type: () => BuyRequest })
    declare data: BuyRequest;
}

export class BuyRequestUpdateStatusResponseDto extends ApiResponseDto<BuyRequest> {
    @ApiProperty({ example: 'BuyRequest status updated successfully' })
    declare message: string;

    @ApiProperty({ type: () => BuyRequest })
    declare data: BuyRequest;
}

export class BuyRequestUpdateOrderStateResponseDto extends ApiResponseDto<BuyRequest> {
    @ApiProperty({ example: 'Order state updated to awaiting_shipping' })
    declare message: string;

    @ApiProperty({ type: () => BuyRequest })
    declare data: BuyRequest;
}

export class BuyRequestUpdateTrackingResponseDto extends ApiResponseDto<BuyRequest> {
    @ApiProperty({ example: 'AgroTrack tracking number linked successfully' })
    declare message: string;

    @ApiProperty({ type: () => BuyRequest })
    declare data: BuyRequest;
}

export class BuyRequestArrangeTransitResponseDto extends ApiResponseDto<BuyRequest> {
    @ApiProperty({ example: 'Shipment arranged with AgroTrack' })
    declare message: string;

    @ApiProperty({ type: () => BuyRequest })
    declare data: BuyRequest;

    @ApiProperty({
        example: false,
        description: 'True when AgroTrack could not resolve a sender automatically — fall back to the manual Arrange Transit flow.',
        required: false,
    })
    requiresManualFallback?: boolean;
}

export class BuyRequestCancelTransitResponseDto extends ApiResponseDto<BuyRequest> {
    @ApiProperty({ example: 'AgroTrack shipment cancelled' })
    declare message: string;

    @ApiProperty({ type: () => BuyRequest })
    declare data: BuyRequest;
}

export class BuyRequestGeneralListResponseDto extends ApiResponseDto<BuyRequest[]> {
    @ApiProperty({ example: 'General buy requests fetched successfully' })
    declare message: string;

    @ApiProperty({ type: () => [BuyRequest] })
    declare data: BuyRequest[];
}

export class BuyRequestListResponseDto extends ApiResponseDto<BuyRequestPaginationData> {
    @ApiProperty({ example: 'Buy requests fetched successfully' })
    declare message: string;

    @ApiProperty({ type: () => BuyRequestPaginationData })
    declare data: BuyRequestPaginationData;
}

export class BuyRequestOngoingOrderListResponseDto extends ApiResponseDto<BuyRequestPaginationData> {
    @ApiProperty({ example: 'Ongoing buyrequest orders fetched successfully' })
    declare message: string;

    @ApiProperty({ type: () => BuyRequestPaginationData })
    declare data: BuyRequestPaginationData;
}

export class BuyRequestFindResponseDto extends ApiResponseDto<BuyRequest> {
    @ApiProperty({ example: 'BuyRequest fetched successfully' })
    declare message: string;

    @ApiProperty({ type: () => BuyRequest })
    declare data: BuyRequest;
}

export class BuyRequestFindByUserIdResponseDto extends ApiResponseDto<BuyRequest[]> {
    @ApiProperty({ example: 'User buy requests fetched successfully' })
    declare message: string;

    @ApiProperty({ type: () => [BuyRequest] })
    declare data: BuyRequest[];
}

export class UploadPurchaseOrderResponseDto extends ApiResponseDto<PurchaseOrderDocFile> {
    @ApiProperty({ example: 'Purchase order doc uploaded successfully' })
    declare message: string;

    @ApiProperty({ type: () => PurchaseOrderDocFile })
    declare data: PurchaseOrderDocFile;
}

export class BuyRequestDeleteResponseDto {
    @ApiProperty({ example: 200 })
    statusCode: number;

    @ApiProperty({ example: "BuyRequest deleted successfully" })
    message: string;
}

export class PurchaseOrderDeleteResponseData {
    @ApiProperty({ example: "l89vuhuhohougfyrf5tgygv" })
    id: string;

    @ApiProperty({ example: "Bhhdsjiioii9j" })
    publicId: string;
}

export class PurchaseOrderDeleteResponseDto {
    @ApiProperty({ example: 200 })
    statusCode: number;

    @ApiProperty({ example: "Purchase order doc file deleted successfully" })
    message: string;

    @ApiProperty({ type: PurchaseOrderDeleteResponseData })
    data: PurchaseOrderDeleteResponseData;
}

export class DirectBuyRequestResponseDto extends ApiResponseDto<DirectBuyRequestResponseData> {
    @ApiProperty({ example: 'Buy request directed successfully' })
    declare message: string;

    @ApiProperty({ type: () => DirectBuyRequestResponseData })
    declare data: DirectBuyRequestResponseData;
}