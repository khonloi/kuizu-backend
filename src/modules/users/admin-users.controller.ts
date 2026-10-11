import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  AdminQueryUsersDto,
  adminQueryUsersSchema,
  UpdateUserRoleDto,
  updateUserRoleSchema,
  UpdateUserStatusDto,
  updateUserStatusSchema,
} from './dto/user.dto';

@ApiTags('Admin - Users')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('admin')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'List and search all users with pagination (Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Paginated user list' })
  async getUsers(
    @Query(new ZodValidationPipe(adminQueryUsersSchema))
    query: AdminQueryUsersDto,
  ) {
    return this.usersService.findAllAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get detailed user profile by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'User profile details' })
  async getUserById(@Param('id') id: string) {
    return this.usersService.findAdminUserById(id);
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Update user role (Admin only)' })
  @ApiResponse({ status: 200, description: 'User role updated' })
  async updateUserRole(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserRoleSchema)) dto: UpdateUserRoleDto,
  ) {
    if (adminId && adminId === id) {
      throw new BadRequestException('Admins cannot modify their own role');
    }
    return this.usersService.updateUserRole(id, dto.role);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update user active/suspended status (Admin only)' })
  @ApiResponse({ status: 200, description: 'User status updated' })
  async updateUserStatus(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserStatusSchema))
    dto: UpdateUserStatusDto,
  ) {
    if (adminId && adminId === id) {
      throw new BadRequestException(
        'Admins cannot change their own account status',
      );
    }
    return this.usersService.updateUserStatus(id, dto.isActive);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user account (Admin only)' })
  @ApiResponse({ status: 200, description: 'User account deleted' })
  async deleteUser(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
  ) {
    if (adminId && adminId === id) {
      throw new BadRequestException(
        'Admins cannot delete their own account via admin management',
      );
    }
    return this.usersService.deleteAccount(id);
  }
}
