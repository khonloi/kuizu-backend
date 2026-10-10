import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { BaseRepository } from '../../../common/database';
import { Course, CourseDocument } from '../schemas/course.schema';
import { CreateCourseDto } from '../dto/course.dto';
import {
  PaginationQueryInputDto,
  PaginatedResponse,
  createOffsetPaginatedResponse,
  createCursorPaginatedResponse,
} from '../../../common/dto';

@Injectable()
export class CourseRepository extends BaseRepository<CourseDocument> {
  constructor(
    @InjectModel(Course.name)
    courseModel: Model<CourseDocument>,
  ) {
    super(courseModel);
  }

  async findPublished(): Promise<CourseDocument[]> {
    return this.find({ isPublished: true });
  }

  async findAllCourses(): Promise<CourseDocument[]> {
    return this.find();
  }

  async findPublishedPaginated(
    query: PaginationQueryInputDto = {},
  ): Promise<PaginatedResponse<CourseDocument>> {
    return this.findCoursesPaginated({ isPublished: true }, query);
  }

  async findAllCoursesPaginated(
    query: PaginationQueryInputDto = {},
  ): Promise<PaginatedResponse<CourseDocument>> {
    return this.findCoursesPaginated({}, query);
  }

  private async findCoursesPaginated(
    filter: QueryFilter<CourseDocument>,
    query: PaginationQueryInputDto = {},
  ): Promise<PaginatedResponse<CourseDocument>> {
    const mongoFilter: Record<string, unknown> = { ...filter };
    const limit = Number(query.limit) > 0 ? Number(query.limit) : 20;
    const isCursorMode = query.mode === 'cursor' || Boolean(query.cursor);

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      mongoFilter.$or = [
        { title: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
        { slug: { $regex: term, $options: 'i' } },
      ];
    }

    if (isCursorMode) {
      if (query.cursor && Types.ObjectId.isValid(query.cursor)) {
        mongoFilter._id = { $lt: new Types.ObjectId(query.cursor) };
      }
      const items = await this.model
        .find(mongoFilter)
        .sort({ _id: -1 })
        .limit(limit + 1)
        .exec();

      return createCursorPaginatedResponse(items, limit);
    }

    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    const sortField = query.sortBy || 'createdAt';
    const sortDirection = query.sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDirection };

    const [total, data] = await Promise.all([
      this.model.countDocuments(mongoFilter).exec(),
      this.model.find(mongoFilter).sort(sort).skip(skip).limit(limit).exec(),
    ]);

    return createOffsetPaginatedResponse(data, total, page, limit);
  }

  async findBySlug(slug: string): Promise<CourseDocument | null> {
    return this.findOne({ slug });
  }

  async createCourse(dto: CreateCourseDto): Promise<CourseDocument> {
    return this.create(dto);
  }

  async deleteCourse(id: string): Promise<CourseDocument | null> {
    return this.findByIdAndDelete(id);
  }
}
