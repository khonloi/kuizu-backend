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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { QuizzesService } from './quizzes.service';
import { CreateQuizDto, createQuizSchema } from './dto/quiz.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

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
    @Body() dto: Partial<CreateQuizDto>,
  ) {
    return this.quizzesService.update(id, userId, dto);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a quiz' })
  async delete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.quizzesService.delete(id, userId);
  }
}
