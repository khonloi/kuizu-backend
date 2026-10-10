import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { CoursesService } from './courses.service';
import { CourseRepository, UserProgressRepository } from './repositories';
import { GamificationService } from '../gamification/gamification.service';

describe('CoursesService', () => {
  let service: CoursesService;
  let mockCourseRepository: any;
  let mockProgressRepository: any;
  let mockGamificationService: any;

  beforeEach(() => {
    mockCourseRepository = {
      findPublished: vi.fn(),
      findAllCourses: vi.fn(),
      findPublishedPaginated: vi.fn(),
      findAllCoursesPaginated: vi.fn(),
      findBySlug: vi.fn(),
      findById: vi.fn(),
      createCourse: vi.fn().mockImplementation((dto) => ({
        _id: new Types.ObjectId(),
        ...dto,
      })),
      deleteCourse: vi.fn(),
    };

    mockProgressRepository = {
      findByUserAndCourse: vi.fn(),
      createProgress: vi.fn().mockImplementation((dto) => ({
        _id: new Types.ObjectId(),
        save: vi.fn().mockResolvedValue(true),
        ...dto,
      })),
    };

    mockGamificationService = {
      addXp: vi.fn().mockResolvedValue(true),
    };

    service = new CoursesService(
      mockCourseRepository as unknown as CourseRepository,
      mockProgressRepository as unknown as UserProgressRepository,
      mockGamificationService as unknown as GamificationService,
    );
  });

  describe('findAll & findAllAdmin', () => {
    it('should return published courses for findAll', async () => {
      const mockResult = [{ title: 'Japanese 1', isPublished: true }];
      mockCourseRepository.findPublished.mockResolvedValue(mockResult);

      const res = await service.findAll();
      expect(mockCourseRepository.findPublished).toHaveBeenCalled();
      expect(res).toEqual(mockResult);
    });

    it('should return all courses for findAllAdmin', async () => {
      const mockResult = [{ title: 'Course 1' }, { title: 'Draft Course' }];
      mockCourseRepository.findAllCourses.mockResolvedValue(mockResult);

      const res = await service.findAllAdmin();
      expect(mockCourseRepository.findAllCourses).toHaveBeenCalled();
      expect(res).toEqual(mockResult);
    });

    it('should delegate to findPublishedPaginated when pagination query is provided to findAll', async () => {
      const mockPaginated = {
        data: [{ title: 'Japanese 1' }],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
          nextCursor: null,
        },
      };
      mockCourseRepository.findPublishedPaginated.mockResolvedValue(
        mockPaginated,
      );

      const query = { page: 1, limit: 10, sortOrder: 'desc' as const };
      const res = await service.findAll(query);

      expect(mockCourseRepository.findPublishedPaginated).toHaveBeenCalledWith(
        query,
      );
      expect(res).toBe(mockPaginated);
    });

    it('should delegate to findAllCoursesPaginated when pagination query is provided to findAllAdmin', async () => {
      const mockPaginated = {
        data: [{ title: 'Admin Course' }],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
          nextCursor: null,
        },
      };
      mockCourseRepository.findAllCoursesPaginated.mockResolvedValue(
        mockPaginated,
      );

      const query = { page: 1, limit: 10, sortOrder: 'desc' as const };
      const res = await service.findAllAdmin(query);

      expect(mockCourseRepository.findAllCoursesPaginated).toHaveBeenCalledWith(
        query,
      );
      expect(res).toBe(mockPaginated);
    });
  });

  describe('findBySlug', () => {
    it('should return course if found', async () => {
      const course = { slug: 'japanese-basics', title: 'Japanese' };
      mockCourseRepository.findBySlug.mockResolvedValue(course);

      const res = await service.findBySlug('japanese-basics');
      expect(res).toEqual(course);
    });

    it('should throw NotFoundException if not found', async () => {
      mockCourseRepository.findBySlug.mockResolvedValue(null);

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
      mockCourseRepository.findById.mockResolvedValue(null);

      await expect(service.findById(validId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return course if found', async () => {
      const validId = new Types.ObjectId().toString();
      const course = { _id: validId, title: 'Spanish' };
      mockCourseRepository.findById.mockResolvedValue(course);

      const res = await service.findById(validId);
      expect(res).toEqual(course);
    });
  });

  describe('create', () => {
    it('should throw ConflictException if slug already exists', async () => {
      mockCourseRepository.findBySlug.mockResolvedValue({
        slug: 'existing-course',
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
      mockCourseRepository.findBySlug.mockResolvedValue(null);

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

      mockCourseRepository.findById.mockResolvedValue(existingCourse);
      mockCourseRepository.findBySlug.mockResolvedValue({
        _id: new Types.ObjectId(),
        slug: 'conflict-slug',
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

      mockCourseRepository.findById.mockResolvedValue(existingCourse);

      await service.update(id, { title: 'New Title' });
      expect(existingCourse.title).toBe('New Title');
      expect(existingCourse.save).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete course and return confirmation', async () => {
      const id = new Types.ObjectId().toString();
      mockCourseRepository.findById.mockResolvedValue({ _id: id });
      mockCourseRepository.deleteCourse.mockResolvedValue({ _id: id });

      const res = await service.delete(id);
      expect(res).toEqual({
        success: true,
        message: 'Course deleted successfully',
      });
      expect(mockCourseRepository.deleteCourse).toHaveBeenCalledWith(id);
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

      mockCourseRepository.findBySlug.mockResolvedValue(mockCourse);
      mockProgressRepository.findByUserAndCourse.mockResolvedValue(
        mockProgress,
      );

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
