import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

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

  @Public()
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
