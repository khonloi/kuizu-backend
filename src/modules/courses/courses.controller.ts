import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  Inject,
  Optional,
} from '@nestjs/common';
import {
  CacheInterceptor,
  CacheTTL,
  CACHE_MANAGER,
  Cache,
} from '@nestjs/cache-manager';

import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  CreateCourseDto,
  createCourseSchema,
  UpdateCourseDto,
  updateCourseSchema,
} from './dto/course.dto';
import {
  OptionalPaginationQueryDto,
  optionalPaginationQuerySchema,
} from '../../common/dto';

@ApiTags('Courses')
@Controller('courses')
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    @Optional() @Inject(CACHE_MANAGER) private readonly cacheManager?: Cache,
  ) {}

  @Public()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60000)
  @Get()
  @ApiOperation({ summary: 'List all published courses with pagination' })
  async getCourses(
    @Query(new ZodValidationPipe(optionalPaginationQuerySchema))
    pagination?: OptionalPaginationQueryDto,
  ) {
    if (
      pagination &&
      (pagination.page ||
        pagination.limit ||
        pagination.cursor ||
        pagination.search ||
        pagination.mode)
    ) {
      return this.coursesService.findAll(pagination);
    }
    return this.coursesService.findAll();
  }

  @ApiBearerAuth()
  @Roles('admin', 'teacher')
  @Get('admin/all')
  @ApiOperation({
    summary: 'List all courses including unpublished (Admin/Teacher only)',
  })
  async getAllCoursesAdmin(
    @Query(new ZodValidationPipe(optionalPaginationQuerySchema))
    pagination?: OptionalPaginationQueryDto,
  ) {
    if (
      pagination &&
      (pagination.page ||
        pagination.limit ||
        pagination.cursor ||
        pagination.search ||
        pagination.mode)
    ) {
      return this.coursesService.findAllAdmin(pagination);
    }
    return this.coursesService.findAllAdmin();
  }

  @ApiBearerAuth()
  @Roles('admin', 'teacher')
  @Post()
  @ApiOperation({ summary: 'Create a new course (Admin/Teacher only)' })
  @ApiResponse({ status: 201, description: 'Course created' })
  async createCourse(
    @Body(new ZodValidationPipe(createCourseSchema)) dto: CreateCourseDto,
  ) {
    const result = await this.coursesService.create(dto);
    await this.cacheManager?.clear();
    return result;
  }

  @ApiBearerAuth()
  @Roles('admin', 'teacher')
  @Put(':id')
  @ApiOperation({ summary: 'Update an existing course (Admin/Teacher only)' })
  async updateCourse(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCourseSchema)) dto: UpdateCourseDto,
  ) {
    const result = await this.coursesService.update(id, dto);
    await this.cacheManager?.clear();
    return result;
  }

  @ApiBearerAuth()
  @Roles('admin', 'teacher')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a course (Admin/Teacher only)' })
  async deleteCourse(@Param('id') id: string) {
    const result = await this.coursesService.delete(id);
    await this.cacheManager?.clear();
    return result;
  }

  @Public()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60000)
  @Get(':slug')
  @ApiOperation({ summary: 'Get course curriculum by slug' })
  async getCourseBySlug(@Param('slug') slug: string) {
    return this.coursesService.findBySlug(slug);
  }

  @ApiBearerAuth()
  @Get(':slug/curriculum')
  @ApiOperation({
    summary: 'Get course curriculum enriched with user progress',
  })
  async getEnrichedCurriculum(
    @Param('slug') slug: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.coursesService.getEnrichedCurriculum(userId, slug);
  }

  @Public()
  @Get(':slug/lessons/:lessonId')
  @ApiOperation({
    summary: 'Get lesson exercises by course slug and lesson ID',
  })
  async getLesson(
    @Param('slug') slug: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.coursesService.getLesson(slug, lessonId);
  }

  @ApiBearerAuth()
  @Get(':slug/progress')
  @ApiOperation({ summary: 'Get current user progress for a course' })
  async getUserProgress(
    @Param('slug') slug: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.coursesService.getUserProgress(userId, slug);
  }

  @ApiBearerAuth()
  @Post(':slug/lessons/:lessonId/complete')
  @ApiOperation({ summary: 'Complete a lesson and earn XP' })
  async completeLesson(
    @Param('slug') slug: string,
    @Param('lessonId') lessonId: string,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.coursesService.completeLesson(
      userId,
      slug,
      lessonId,
    );
    await this.cacheManager?.clear();
    return result;
  }
}
