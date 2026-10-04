import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Courses')
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all published courses' })
  async getCourses() {
    return this.coursesService.findAll();
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get course curriculum by slug' })
  async getCourseBySlug(@Param('slug') slug: string) {
    return this.coursesService.findBySlug(slug);
  }

  @Public()
  @Get(':slug/lessons/:lessonId')
  @ApiOperation({ summary: 'Get lesson exercises by course slug and lesson ID' })
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
    @Body('xp') xp?: number,
  ) {
    return this.coursesService.completeLesson(userId, slug, lessonId, xp || 15);
  }
}
