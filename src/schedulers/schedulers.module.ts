import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BuyRequest } from 'src/buy-requests/entities/buy-request.entity';
import { BuyRequestsScheduler } from './buy-requests.scheduler';
import { AgroTrackReconciliationScheduler } from './agrotrack-reconciliation.scheduler';
import { ProductInventoriesModule } from 'src/product-inventories/product-inventories.module';
import { AgroTrackClientModule } from 'src/integrations/agrotrack/agrotrack-client.module';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Enables scheduling globally - This boots up the global scheduler engine
    TypeOrmModule.forFeature([BuyRequest]), // For repository access
    ProductInventoriesModule,
    AgroTrackClientModule,
  ],
  providers: [BuyRequestsScheduler, AgroTrackReconciliationScheduler],
})
export class SchedulersModule {}
