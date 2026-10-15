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
  Optional,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AuditService } from '../audit/audit.service';
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
  constructor(
    private readonly usersService: UsersService,
    @Optional() private readonly auditService?: AuditService,
  ) {}

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
    const result = await this.usersService.updateUserRole(id, dto.role);
    if (this.auditService) {
      void this.auditService.logAction({
        userId: adminId,
        action: 'USER_ROLE_UPDATED',
        targetEntity: 'User',
        targetId: id,
        details: { newRole: dto.role },
      });
    }
    return result;
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
    const result = await this.usersService.updateUserStatus(id, dto.isActive);
    if (this.auditService) {
      void this.auditService.logAction({
        userId: adminId,
        action: 'USER_STATUS_UPDATED',
        targetEntity: 'User',
        targetId: id,
        details: { isActive: dto.isActive },
      });
    }
    return result;
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
    const result = await this.usersService.deleteAccount(id);
    if (this.auditService) {
      void this.auditService.logAction({
        userId: adminId,
        action: 'USER_DELETED_BY_ADMIN',
        targetEntity: 'User',
        targetId: id,
      });
    }
    return result;
  }
}
