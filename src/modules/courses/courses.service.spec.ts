import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { CoursesService } from './courses.service';

describe('CoursesService', () => {
  let service: CoursesService;
  let mockCourseModel: any;
  let mockProgressModel: any;
  let mockUsersService: any;

  beforeEach(() => {
    mockCourseModel = vi.fn().mockImplementation(function (
      this: any,
      dto: any,
    ) {
      Object.assign(this, dto);
      this.save = vi
        .fn()
        .mockResolvedValue({ _id: new Types.ObjectId(), ...dto });
    });
    mockCourseModel.find = vi.fn();
    mockCourseModel.findOne = vi.fn();
    mockCourseModel.findById = vi.fn();
    mockCourseModel.findByIdAndDelete = vi.fn();

    mockProgressModel = vi.fn().mockImplementation(function (
      this: any,
      dto: any,
    ) {
      Object.assign(this, dto);
      this.save = vi
        .fn()
        .mockResolvedValue({ _id: new Types.ObjectId(), ...dto });
    });
    mockProgressModel.findOne = vi.fn();
    mockProgressModel.create = vi.fn();

    mockUsersService = {
      addXp: vi.fn().mockResolvedValue(true),
    };

    service = new CoursesService(
      mockCourseModel,
      mockProgressModel,
      mockUsersService,
    );
  });

  describe('findAll & findAllAdmin', () => {
    it('should return published courses for findAll', async () => {
      const mockResult = [{ title: 'Japanese 1', isPublished: true }];
      mockCourseModel.find.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockResult),
      });

      const res = await service.findAll();
      expect(mockCourseModel.find).toHaveBeenCalledWith({ isPublished: true });
      expect(res).toEqual(mockResult);
    });

    it('should return all courses for findAllAdmin', async () => {
      const mockResult = [{ title: 'Course 1' }, { title: 'Draft Course' }];
      mockCourseModel.find.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockResult),
      });

      const res = await service.findAllAdmin();
      expect(mockCourseModel.find).toHaveBeenCalledWith();
      expect(res).toEqual(mockResult);
    });
  });

  describe('findBySlug', () => {
    it('should return course if found', async () => {
      const course = { slug: 'japanese-basics', title: 'Japanese' };
      mockCourseModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(course),
      });

      const res = await service.findBySlug('japanese-basics');
      expect(res).toEqual(course);
    });

    it('should throw NotFoundException if not found', async () => {
      mockCourseModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });

      await expect(service.findBySlug('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findById', () => {
    it('should throw BadRequestException if id is invalid ObjectId', async () => {
      await expect(service.findById('invalid-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if course not found', async () => {
      const validId = new Types.ObjectId().toString();
      mockCourseModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });

      await expect(service.findById(validId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return course if found', async () => {
      const validId = new Types.ObjectId().toString();
      const course = { _id: validId, title: 'Spanish' };
      mockCourseModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(course),
      });

      const res = await service.findById(validId);
      expect(res).toEqual(course);
    });
  });

  describe('create', () => {
    it('should throw ConflictException if slug already exists', async () => {
      mockCourseModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ slug: 'existing-course' }),
      });

      await expect(
        service.create({
          title: 'New Course',
          slug: 'existing-course',
          units: [],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create and return course if slug is unique', async () => {
      mockCourseModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });

      const dto = { title: 'New Course', slug: 'unique-slug', units: [] };
      const res = await service.create(dto);
      expect(res.title).toBe(dto.title);
      expect(res.slug).toBe(dto.slug);
    });
  });

  describe('update', () => {
    it('should throw ConflictException if updated slug conflicts with existing course', async () => {
      const id = new Types.ObjectId().toString();
      const existingCourse = { _id: id, slug: 'orig-slug', save: vi.fn() };

      mockCourseModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(existingCourse),
      });
      mockCourseModel.findOne.mockReturnValue({
        exec: vi
          .fn()
          .mockResolvedValue({
            _id: new Types.ObjectId(),
            slug: 'conflict-slug',
          }),
      });

      await expect(
        service.update(id, { slug: 'conflict-slug' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should successfully update course', async () => {
      const id = new Types.ObjectId().toString();
      const existingCourse = {
        _id: id,
        title: 'Old Title',
        slug: 'slug',
        save: vi
          .fn()
          .mockResolvedValue({ _id: id, title: 'New Title', slug: 'slug' }),
      };

      mockCourseModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(existingCourse),
      });

      await service.update(id, { title: 'New Title' });
      expect(existingCourse.title).toBe('New Title');
      expect(existingCourse.save).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete course and return confirmation', async () => {
      const id = new Types.ObjectId().toString();
      mockCourseModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: id }),
      });
      mockCourseModel.findByIdAndDelete.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: id }),
      });

      const res = await service.delete(id);
      expect(res).toEqual({
        success: true,
        message: 'Course deleted successfully',
      });
      expect(mockCourseModel.findByIdAndDelete).toHaveBeenCalledWith(id);
    });
  });

  describe('getEnrichedCurriculum', () => {
    it('should return units with calculated isCompleted, isLocked, and isCurrent flags', async () => {
      const userId = new Types.ObjectId().toString();
      const mockCourse = {
        _id: new Types.ObjectId(),
        title: 'Korean 1',
        slug: 'korean-1',
        description: 'Learn Hangul',
        icon: 'flag',
        isPublished: true,
        units: [
          {
            id: 'u1',
            title: 'Alphabet',
            description: 'Vowels & Consonants',
            color: '#1cb0f6',
            order: 1,
            lessons: [
              {
                id: 'l1',
                title: 'Lesson 1',
                icon: 'star',
                order: 1,
                xpReward: 10,
                exercises: [1, 2],
              },
              {
                id: 'l2',
                title: 'Lesson 2',
                icon: 'star',
                order: 2,
                xpReward: 10,
                exercises: [1],
              },
              {
                id: 'l3',
                title: 'Lesson 3',
                icon: 'star',
                order: 3,
                xpReward: 10,
                exercises: [],
              },
            ],
          },
        ],
      };

      const mockProgress = {
        completedLessonIds: ['l1'],
        totalXpEarned: 10,
        currentUnit: 1,
      };

      mockCourseModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockCourse),
      });
      mockProgressModel.findOne.mockResolvedValue(mockProgress);

      const res = await service.getEnrichedCurriculum(userId, 'korean-1');

      expect(res.course.slug).toBe('korean-1');
      expect(res.units[0].lessons[0].isCompleted).toBe(true);
      expect(res.units[0].lessons[0].isLocked).toBe(false);
      expect(res.units[0].lessons[0].isCurrent).toBe(false);

      // l2 should be unlocked and current
      expect(res.units[0].lessons[1].isCompleted).toBe(false);
      expect(res.units[0].lessons[1].isLocked).toBe(false);
      expect(res.units[0].lessons[1].isCurrent).toBe(true);

      // l3 should be locked
      expect(res.units[0].lessons[2].isCompleted).toBe(false);
      expect(res.units[0].lessons[2].isLocked).toBe(true);
      expect(res.units[0].lessons[2].isCurrent).toBe(false);
    });
  });
});
