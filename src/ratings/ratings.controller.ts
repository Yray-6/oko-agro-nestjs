import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { CreateRatingDto } from './dtos/create-rating.dto';
import { User } from 'src/users/entities/user.entity';
import { CreateRatingResponseDto, UserRatingsStatsResponseDto } from './dtos/response.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('ratings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ratings')
export class RatingsController {
    constructor(private readonly ratingsService: RatingsService) {}

    @Post('create')
    @ApiOperation({ summary: 'Create a rating for a completed buy request', description: 'Allows buyer or seller involved in a buy request to rate the other party once.'})
    @ApiResponse({ status: 201, description: 'Rating created successfully', type: CreateRatingResponseDto })
    async createRating(@Body() dto: CreateRatingDto, @CurrentUser() currentUser: User) {
        return this.ratingsService.createRating(dto, currentUser);
    }

    @Get('/users/:id/ratings')
    @ApiOperation({ summary: 'Get aggregated rating stats for a user', description: 'Returns average rating, total ratings, and breakdown by score.' })
    @ApiParam({
        name: 'id',
        description: 'User ID whose ratings are being retrieved',
        example: 'uuid',
    })
    @ApiResponse({ status: 200, description: 'User rating statistics retrieved successfully', type: UserRatingsStatsResponseDto})
    async getUserRatingsStats(@Param('id') userId: string) {
        return this.ratingsService.getUserRatingsStats(userId);
    }

}