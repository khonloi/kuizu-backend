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
  ApiQuery,
} from '@nestjs/swagger';
import { QuestionsService } from './questions.service';
import {
  CreateQuestionDto,
  createQuestionSchema,
  UpdateQuestionDto,
  updateQuestionSchema,
} from './dto/question.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Questions')
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List questions from the question bank' })
  @ApiQuery({ name: 'author', required: false })
  @ApiQuery({ name: 'tag', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'difficulty', required: false })
  async findAll(
    @Query('author') author?: string,
    @Query('tag') tag?: string,
    @Query('search') search?: string,
    @Query('difficulty') difficulty?: string,
  ) {
    return this.questionsService.findAll({
      authorId: author,
      tag,
      search,
      difficulty,
    });
  }

  @ApiBearerAuth()
  @Get('my')
  @ApiOperation({ summary: 'Get questions created by current user' })
  async findMyQuestions(@CurrentUser('id') userId: string) {
    return this.questionsService.findAll({ authorId: userId });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a specific question by ID' })
  async findOne(@Param('id') id: string) {
    return this.questionsService.findOne(id);
  }

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a new question in the question bank' })
  @ApiResponse({ status: 201, description: 'Question created' })
  async create(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(createQuestionSchema)) dto: CreateQuestionDto,
  ) {
    return this.questionsService.create(userId, dto);
  }

  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({ summary: 'Update an existing question' })
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
    @Body(new ZodValidationPipe(updateQuestionSchema)) dto: UpdateQuestionDto,
  ) {
    const isAdmin = userRole === 'admin';
    return this.questionsService.update(id, userId, dto, isAdmin);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a question from the question bank' })
  async delete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const isAdmin = userRole === 'admin';
    return this.questionsService.delete(id, userId, isAdmin);
  }
}
