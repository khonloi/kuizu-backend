import {
  Controller,
  Get,
  Param,
  Patch,
  Delete,
  Post,
  Body,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UpdateProfileDto, updateProfileSchema } from './dto/user.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current logged-in user profile' })
  @Get('me')
  async getMyProfile(@CurrentUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current logged-in user profile' })
  @Patch('me')
  async updateMyProfile(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(updateProfileSchema)) dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete current logged-in user account' })
  @Delete('me')
  async deleteMyAccount(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
    return this.usersService.deleteAccount(userId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record daily activity to update streak' })
  @Post('me/activity')
  async recordActivity(@CurrentUser('id') userId: string) {
    return this.usersService.recordActivity(userId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refill hearts using gems' })
  @Post('me/hearts/refill')
  async refillHearts(@CurrentUser('id') userId: string) {
    return this.usersService.refillHearts(userId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consume a heart during practice/quiz' })
  @Post('me/hearts/consume')
  async consumeHeart(@CurrentUser('id') userId: string) {
    return this.usersService.consumeHeart(userId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Purchase a streak freeze using gems' })
  @Post('me/streak/freeze')
  async buyStreakFreeze(@CurrentUser('id') userId: string) {
    return this.usersService.buyStreakFreeze(userId);
  }

  @Public()
  @UseInterceptors(CacheInterceptor)
  @CacheKey('users:leaderboard')
  @CacheTTL(30000)
  @ApiOperation({ summary: 'Get public global leaderboard' })
  @Get('leaderboard')
  async getLeaderboard() {
    return this.usersService.getLeaderboard();
  }

  @Public()
  @ApiOperation({ summary: 'Get public user profile by ID' })
  @ApiResponse({ status: 200, description: 'Public user profile' })
  @Get(':id')
  async getUserProfile(@Param('id') id: string) {
    return this.usersService.getProfile(id);
  }
}
