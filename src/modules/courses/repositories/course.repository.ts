import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepository } from '../../../common/database';
import { Course, CourseDocument } from '../schemas/course.schema';
import { CreateCourseDto } from '../dto/course.dto';
import {
  PaginationQueryInputDto,
  PaginatedResponse,
} from '../../../common/dto';

const ALLOWED_COURSE_SORT_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'title',
  'slug',
  'difficulty',
]);

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
    return this.paginate({ isPublished: true }, query, {
      searchFields: ['title', 'description', 'slug'],
      allowedSortFields: ALLOWED_COURSE_SORT_FIELDS,
    });
  }

  async findAllCoursesPaginated(
    query: PaginationQueryInputDto = {},
  ): Promise<PaginatedResponse<CourseDocument>> {
    return this.paginate({}, query, {
      searchFields: ['title', 'description', 'slug'],
      allowedSortFields: ALLOWED_COURSE_SORT_FIELDS,
    });
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
