import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CropsModule } from './crops/crops.module';
import { FilesModule } from './files/files.module';
import ormconfig from './config/ormconfig';
import { MailerModule } from './mailer/mailer.module';
import { CertificationsModule } from './certifications/certifications.module';
import { QualityStandardsModule } from './quality-standards/quality-standards.module';
import { ProductsModule } from './products/products.module';
import { FarmerProductPhotoFilesModule } from './farmer-product-photo-files/farmer-product-photo-files.module';
import { EventsModule } from './events/events.module';
import { BuyRequestsModule } from './buy-requests/buy-requests.module';
import { SchedulersModule } from './schedulers/schedulers.module';
import { AdminModule } from './admin/admin.module';
import { PurchaseOrderDocFilesModule } from './purchase-order-doc-files/purchase-order-doc-files.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DisputesModule } from './disputes/disputes.module';
import { RatingsModule } from './ratings/ratings.module';
import { SmsModule } from './sms/sms.module';
import { ProductInventoriesModule } from './product-inventories/product-inventories.module';
import { AgroTrackClientModule } from './integrations/agrotrack/agrotrack-client.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // Makes ConfigService available everywhere
    TypeOrmModule.forRoot(ormconfig),
    UsersModule, AuthModule, CropsModule, FilesModule, MailerModule,
    CertificationsModule, QualityStandardsModule, ProductsModule,
    FarmerProductPhotoFilesModule, EventsModule, BuyRequestsModule,
    SchedulersModule, AdminModule, PurchaseOrderDocFilesModule,
    PurchaseOrderDocFilesModule, NotificationsModule, DisputesModule,
    RatingsModule, SmsModule, ProductInventoriesModule, AgroTrackClientModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
