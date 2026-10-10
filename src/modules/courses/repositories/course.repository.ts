import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepository } from '../../../common/database';
import { Course, CourseDocument } from '../schemas/course.schema';
import { CreateCourseDto } from '../dto/course.dto';

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
