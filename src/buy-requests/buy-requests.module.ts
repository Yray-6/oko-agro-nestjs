import { Module } from '@nestjs/common';
import { BuyRequestsService } from './buy-requests.service';
import { BuyRequestsController } from './buy-requests.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/users/users.module';
import { BuyRequest } from './entities/buy-request.entity';
import { Crop } from 'src/crops/entities/crop.entity';
import { QualityStandard } from 'src/quality-standards/entities/quality-standard.entity';
import { Product } from 'src/products/entities/product.entity';
import { PurchaseOrderDocFile } from 'src/purchase-order-doc-files/entities/purchase-order-doc-file.entity';
import { PurchaseOrderDocFilesModule } from 'src/purchase-order-doc-files/purchase-order-doc-files.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { ProductInventoriesModule } from 'src/product-inventories/product-inventories.module';
import { User } from 'src/users/entities/user.entity';
import { AgroTrackClientModule } from 'src/integrations/agrotrack/agrotrack-client.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BuyRequest,
      Crop,
      QualityStandard,
      Product,
      PurchaseOrderDocFile,
      User,
    ]),
    PurchaseOrderDocFilesModule,
    AuthModule,
    UsersModule,
    NotificationsModule,
    ProductInventoriesModule,
    AgroTrackClientModule,
  ],
  providers: [BuyRequestsService],
  controllers: [BuyRequestsController],
})
export class BuyRequestsModule {}
