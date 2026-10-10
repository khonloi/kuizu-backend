import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

describe('CoursesController', () => {
  let controller: CoursesController;
  let service: CoursesService;

  beforeEach(() => {
    service = {
      findAll: vi.fn(),
      findAllAdmin: vi.fn(),
      findBySlug: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getLesson: vi.fn(),
      getUserProgress: vi.fn(),
      completeLesson: vi.fn(),
      getEnrichedCurriculum: vi.fn(),
    } as unknown as CoursesService;

    controller = new CoursesController(service);
  });

  it('getCourses should delegate to service.findAll', async () => {
    const expected = [{ title: 'Japanese' }];
    const spy = vi.spyOn(service, 'findAll').mockResolvedValue(expected as any);

    const res = await controller.getCourses();
    expect(res).toBe(expected);
    expect(spy).toHaveBeenCalled();
  });

  it('getCourses should delegate to service.findAll with pagination when provided', async () => {
    const expected = {
      data: [{ title: 'Japanese' }],
      meta: { limit: 10, page: 1, hasNextPage: false },
    };
    const spy = vi.spyOn(service, 'findAll').mockResolvedValue(expected as any);

    const pagination = { page: 1, limit: 10, sortOrder: 'desc' as const };
    const res = await controller.getCourses(pagination);
    expect(res).toBe(expected);
    expect(spy).toHaveBeenCalledWith(pagination);
  });

  it('getAllCoursesAdmin should delegate to service.findAllAdmin', async () => {
    const expected = [{ title: 'Course 1' }, { title: 'Draft' }];
    const spy = vi
      .spyOn(service, 'findAllAdmin')
      .mockResolvedValue(expected as any);

    const res = await controller.getAllCoursesAdmin();
    expect(res).toBe(expected);
    expect(spy).toHaveBeenCalled();
  });

  it('getAllCoursesAdmin should delegate to service.findAllAdmin with pagination when provided', async () => {
    const expected = {
      data: [{ title: 'Course 1' }],
      meta: { limit: 10, page: 2, hasNextPage: false },
    };
    const spy = vi
      .spyOn(service, 'findAllAdmin')
      .mockResolvedValue(expected as any);

    const pagination = { page: 2, limit: 10, sortOrder: 'desc' as const };
    const res = await controller.getAllCoursesAdmin(pagination);
    expect(res).toBe(expected);
    expect(spy).toHaveBeenCalledWith(pagination);
  });

  it('createCourse should delegate to service.create', async () => {
    const dto = { title: 'French', slug: 'french-1', units: [] };
    const expected = { _id: '123', ...dto };
    const spy = vi.spyOn(service, 'create').mockResolvedValue(expected as any);

    const res = await controller.createCourse(dto as any);
    expect(res).toBe(expected);
    expect(spy).toHaveBeenCalledWith(dto);
  });

  it('updateCourse should delegate to service.update', async () => {
    const dto = { title: 'French Advanced' };
    const expected = { _id: '123', title: 'French Advanced' };
    const spy = vi.spyOn(service, 'update').mockResolvedValue(expected as any);

    const res = await controller.updateCourse('123', dto as any);
    expect(res).toBe(expected);
    expect(spy).toHaveBeenCalledWith('123', dto);
  });

  it('deleteCourse should delegate to service.delete', async () => {
    const expected = { success: true, message: 'Course deleted successfully' };
    const spy = vi.spyOn(service, 'delete').mockResolvedValue(expected);

    const res = await controller.deleteCourse('123');
    expect(res).toBe(expected);
    expect(spy).toHaveBeenCalledWith('123');
  });

  it('getEnrichedCurriculum should delegate to service.getEnrichedCurriculum', async () => {
    const expected = { course: {}, progress: {}, units: [] };
    const spy = vi
      .spyOn(service, 'getEnrichedCurriculum')
      .mockResolvedValue(expected as any);

    const res = await controller.getEnrichedCurriculum('french-1', 'user-123');
    expect(res).toBe(expected);
    expect(spy).toHaveBeenCalledWith('user-123', 'french-1');
  });

  it('completeLesson should delegate to service.completeLesson with default or custom xp', async () => {
    const expected = { success: true, xpEarned: 20, progress: {} as any };
    const spy = vi.spyOn(service, 'completeLesson').mockResolvedValue(expected);

    const res = await controller.completeLesson(
      'french-1',
      'lesson-1',
      'user-123',
      20,
    );
    expect(res).toBe(expected);
    expect(spy).toHaveBeenCalledWith('user-123', 'french-1', 'lesson-1', 20);
  });
});
