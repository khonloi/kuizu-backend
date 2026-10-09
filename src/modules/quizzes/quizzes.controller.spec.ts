import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuizzesController } from './quizzes.controller';
import { QuizzesService } from './quizzes.service';

describe('QuizzesController', () => {
  let controller: QuizzesController;
  let service: QuizzesService;

  beforeEach(() => {
    service = {
      findAll: vi.fn(),
      findAllAdmin: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      incrementPlayCount: vi.fn(),
    } as unknown as QuizzesService;

    controller = new QuizzesController(service);
  });

  it('findAll should delegate to service.findAll with false and authorId', async () => {
    const mockQuizzes = [{ title: 'Q1' }];
    const spy = vi
      .spyOn(service, 'findAll')
      .mockResolvedValue(mockQuizzes as any);

    const res = await controller.findAll('author-123');
    expect(res).toBe(mockQuizzes);
    expect(spy).toHaveBeenCalledWith(false, 'author-123');
  });

  it('findMyQuizzes should delegate to service.findAll with true and userId', async () => {
    const mockQuizzes = [{ title: 'My Quiz' }];
    const spy = vi
      .spyOn(service, 'findAll')
      .mockResolvedValue(mockQuizzes as any);

    const res = await controller.findMyQuizzes('user-123');
    expect(res).toBe(mockQuizzes);
    expect(spy).toHaveBeenCalledWith(true, 'user-123');
  });

  it('findAllAdmin should delegate to service.findAllAdmin', async () => {
    const mockQuizzes = [{ title: 'Admin View All' }];
    const spy = vi
      .spyOn(service, 'findAllAdmin')
      .mockResolvedValue(mockQuizzes as any);

    const res = await controller.findAllAdmin();
    expect(res).toBe(mockQuizzes);
    expect(spy).toHaveBeenCalled();
  });

  it('findOne should delegate to service.findOne', async () => {
    const mockQuiz = { title: 'Specific Quiz' };
    const spy = vi.spyOn(service, 'findOne').mockResolvedValue(mockQuiz as any);

    const res = await controller.findOne('quiz-123');
    expect(res).toBe(mockQuiz);
    expect(spy).toHaveBeenCalledWith('quiz-123');
  });

  it('create should delegate to service.create with userId and dto', async () => {
    const dto = { title: 'New Quiz', questionIds: [] };
    const mockCreated = { _id: 'created-id', ...dto };
    const spy = vi
      .spyOn(service, 'create')
      .mockResolvedValue(mockCreated as any);

    const res = await controller.create('user-123', dto as any);
    expect(res).toBe(mockCreated);
    expect(spy).toHaveBeenCalledWith('user-123', dto);
  });

  it('update should delegate to service.update with isAdmin check', async () => {
    const dto = { title: 'Updated' };
    const mockUpdated = { _id: 'quiz-123', ...dto };
    const spy = vi
      .spyOn(service, 'update')
      .mockResolvedValue(mockUpdated as any);

    const res = await controller.update(
      'quiz-123',
      'admin-id',
      'admin',
      dto as any,
    );
    expect(res).toBe(mockUpdated);
    expect(spy).toHaveBeenCalledWith('quiz-123', 'admin-id', dto, true);
  });

  it('delete should delegate to service.delete with isAdmin check', async () => {
    const mockResult = { success: true };
    const spy = vi.spyOn(service, 'delete').mockResolvedValue(mockResult);

    const res = await controller.delete('quiz-123', 'user-id', 'user');
    expect(res).toBe(mockResult);
    expect(spy).toHaveBeenCalledWith('quiz-123', 'user-id', false);
  });
});
