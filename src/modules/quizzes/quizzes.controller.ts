import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { QuizzesService } from './quizzes.service';
import {
  CreateQuizDto,
  createQuizSchema,
  UpdateQuizDto,
  updateQuizSchema,
} from './dto/quiz.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Quizzes')
@Controller('quizzes')
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List public quizzes' })
  async findAll(@Query('author') authorId?: string) {
    return this.quizzesService.findAll(false, authorId);
  }

  @ApiBearerAuth()
  @Get('my')
  @ApiOperation({ summary: 'Get quizzes created by logged-in user' })
  async findMyQuizzes(@CurrentUser('id') userId: string) {
    return this.quizzesService.findAll(true, userId);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @Get('admin/all')
  @ApiOperation({ summary: 'List all quizzes including private (Admin only)' })
  async findAllAdmin() {
    return this.quizzesService.findAllAdmin();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a specific quiz by ID' })
  async findOne(@Param('id') id: string) {
    return this.quizzesService.findOne(id);
  }

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a new quiz' })
  @ApiResponse({ status: 201, description: 'Quiz created' })
  async create(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(createQuizSchema)) dto: CreateQuizDto,
  ) {
    return this.quizzesService.create(userId, dto);
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
    return this.quizzesService.update(id, userId, dto, isAdmin);
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
    return this.quizzesService.delete(id, userId, isAdmin);
  }
}
