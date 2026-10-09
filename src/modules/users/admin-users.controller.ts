import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
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
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserRoleSchema)) dto: UpdateUserRoleDto,
  ) {
    return this.usersService.updateUserRole(id, dto.role);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update user active/suspended status (Admin only)' })
  @ApiResponse({ status: 200, description: 'User status updated' })
  async updateUserStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserStatusSchema))
    dto: UpdateUserStatusDto,
  ) {
    return this.usersService.updateUserStatus(id, dto.isActive);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user account (Admin only)' })
  @ApiResponse({ status: 200, description: 'User account deleted' })
  async deleteUser(@Param('id') id: string) {
    return this.usersService.deleteAccount(id);
  }
}
