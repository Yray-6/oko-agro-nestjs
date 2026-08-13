import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { User } from 'src/users/entities/user.entity';
import { AgroTrackIntegrationService } from './agrotrack-integration.service';

/**
 * Browser-facing half of the Oko SSO handoff (Package 6) — a logged-in Oko
 * farmer hits this to get a token their browser then redeems at AgroTrack's
 * POST /api/v1/auth/sso/consume/, skipping a second login. Optional: nothing
 * built in Packages 1-5 depends on this existing.
 */
@ApiTags('agrotrack-integration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integrations/agrotrack')
export class AgroTrackSsoController {
  constructor(
    private readonly agroTrackIntegration: AgroTrackIntegrationService,
  ) {}

  @Get('sso-handoff-token')
  @ApiOperation({
    summary:
      'Issue a one-time token to skip a second AgroTrack login for this farmer',
  })
  @ApiResponse({ status: 200, description: 'Token issued' })
  @ApiResponse({
    status: 404,
    description: 'No AgroTrack account linked yet — arrange a shipment first',
  })
  async getHandoffToken(@CurrentUser() currentUser: User) {
    const result = await this.agroTrackIntegration.issueSsoHandoffToken(
      currentUser.id,
    );
    if (!result) {
      throw new NotFoundException(
        'No linked AgroTrack account yet — arrange a shipment first.',
      );
    }
    return { statusCode: 200, message: 'Handoff token issued', data: result };
  }
}
