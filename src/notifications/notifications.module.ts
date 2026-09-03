import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { NotificationsController } from './notifications.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { BuyRequest } from 'src/buy-requests/entities/buy-request.entity';
import { Product } from 'src/products/entities/product.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, BuyRequest, Product]),
    AuthModule
  ],
  providers: [NotificationsService],
  exports: [NotificationsService],
  controllers: [NotificationsController]
})
export class NotificationsModule {}
