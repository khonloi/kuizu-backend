import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  Optional,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { QuizzesService } from './quizzes.service';
import {
  CacheInvalidationService,
  CacheNamespace,
} from '../../common/cache/cache-invalidation.service';
import {
  CreateQuizDto,
  createQuizSchema,
  UpdateQuizDto,
  updateQuizSchema,
} from './dto/quiz.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalAuth } from '../../common/decorators/optional-auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  OptionalPaginationQueryDto,
  optionalPaginationQuerySchema,
} from '../../common/dto';
import type { AuthUser } from '../auth/services/token.service';

@ApiTags('Quizzes')
@Controller('quizzes')
export class QuizzesController {
  constructor(
    private readonly quizzesService: QuizzesService,
    @Optional()
    private readonly cacheInvalidationService?: CacheInvalidationService,
  ) {}

  private async invalidateQuizCache(): Promise<void> {
    await this.cacheInvalidationService?.invalidate(CacheNamespace.QUIZZES);
  }

  private hasPagination(pagination?: OptionalPaginationQueryDto): boolean {
    return Boolean(
      pagination &&
      (pagination.page ||
        pagination.limit ||
        pagination.cursor ||
        pagination.search ||
        pagination.mode),
    );
  }

  @Public()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @Get()
  @ApiOperation({ summary: 'List public quizzes with pagination' })
  async findAll(
    @Query('author') authorId?: string,
    @Query(new ZodValidationPipe(optionalPaginationQuerySchema))
    pagination?: OptionalPaginationQueryDto,
  ) {
    if (this.hasPagination(pagination)) {
      return this.quizzesService.findAll(false, authorId, pagination);
    }
    return this.quizzesService.findAll(false, authorId);
  }

  @ApiBearerAuth()
  @Get('my')
  @ApiOperation({ summary: 'Get quizzes created by logged-in user' })
  async findMyQuizzes(
    @CurrentUser('id') userId: string,
    @Query(new ZodValidationPipe(optionalPaginationQuerySchema))
    pagination?: OptionalPaginationQueryDto,
  ) {
    if (this.hasPagination(pagination)) {
      return this.quizzesService.findAll(true, userId, pagination);
    }
    return this.quizzesService.findAll(true, userId);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @Get('admin/all')
  @ApiOperation({ summary: 'List all quizzes including private (Admin only)' })
  async findAllAdmin(
    @Query(new ZodValidationPipe(optionalPaginationQuerySchema))
    pagination?: OptionalPaginationQueryDto,
  ) {
    if (this.hasPagination(pagination)) {
      return this.quizzesService.findAllAdmin(pagination);
    }
    return this.quizzesService.findAllAdmin();
  }

  @OptionalAuth()
  @Get(':id')
  @ApiOperation({ summary: 'Get a specific quiz by ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.quizzesService.findOne(id, user, true);
  }

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a new quiz' })
  @ApiResponse({ status: 201, description: 'Quiz created' })
  async create(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(createQuizSchema)) dto: CreateQuizDto,
  ) {
    const result = await this.quizzesService.create(userId, dto);
    await this.invalidateQuizCache();
    return result;
  }

  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({ summary: 'Update an existing quiz' })
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
    @Body(new ZodValidationPipe(updateQuizSchema)) dto: UpdateQuizDto,
  ) {
    const isAdmin = userRole === 'admin';
    const result = await this.quizzesService.update(id, userId, dto, isAdmin);
    await this.invalidateQuizCache();
    return result;
  }

  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a quiz' })
  async delete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const isAdmin = userRole === 'admin';
    const result = await this.quizzesService.delete(id, userId, isAdmin);
    await this.invalidateQuizCache();
    return result;
  }
}
