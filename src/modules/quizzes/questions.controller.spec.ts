import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';

describe('QuestionsController', () => {
  let controller: QuestionsController;
  let service: QuestionsService;

  beforeEach(() => {
    service = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as QuestionsService;

    controller = new QuestionsController(service);
  });

  it('findAll should delegate to service.findAll with filter params', async () => {
    const mockQuestions = [{ questionText: 'Q1' }];
    const spy = vi
      .spyOn(service, 'findAll')
      .mockResolvedValue(mockQuestions as any);

    const res = await controller.findAll('author-1', 'tag-1', 'query', 'easy');
    expect(res).toBe(mockQuestions);
    expect(spy).toHaveBeenCalledWith({
      authorId: 'author-1',
      tag: 'tag-1',
      search: 'query',
      difficulty: 'easy',
    });
  });

  it('findMyQuestions should delegate to service.findAll with current userId', async () => {
    const mockQuestions = [{ questionText: 'My Question' }];
    const spy = vi
      .spyOn(service, 'findAll')
      .mockResolvedValue(mockQuestions as any);

    const res = await controller.findMyQuestions('user-123');
    expect(res).toBe(mockQuestions);
    expect(spy).toHaveBeenCalledWith({ authorId: 'user-123' });
  });

  it('findOne should delegate to service.findOne', async () => {
    const mockQuestion = { questionText: 'Q1' };
    const spy = vi
      .spyOn(service, 'findOne')
      .mockResolvedValue(mockQuestion as any);

    const res = await controller.findOne('q-123');
    expect(res).toBe(mockQuestion);
    expect(spy).toHaveBeenCalledWith('q-123');
  });

  it('create should delegate to service.create with userId and dto', async () => {
    const dto = {
      questionText: 'New Question',
      choices: [{ text: 'Opt 1', isCorrect: true }],
    };
    const mockCreated = { _id: 'q-new', ...dto };
    const spy = vi
      .spyOn(service, 'create')
      .mockResolvedValue(mockCreated as any);

    const res = await controller.create('user-123', dto as any);
    expect(res).toBe(mockCreated);
    expect(spy).toHaveBeenCalledWith('user-123', dto);
  });

  it('update should delegate to service.update with isAdmin check', async () => {
    const dto = { questionText: 'Updated Question' };
    const mockUpdated = { _id: 'q-123', ...dto };
    const spy = vi
      .spyOn(service, 'update')
      .mockResolvedValue(mockUpdated as any);

    const res = await controller.update(
      'q-123',
      'admin-id',
      'admin',
      dto as any,
    );
    expect(res).toBe(mockUpdated);
    expect(spy).toHaveBeenCalledWith('q-123', 'admin-id', dto, true);
  });

  it('delete should delegate to service.delete with isAdmin check', async () => {
    const mockResult = { success: true };
    const spy = vi.spyOn(service, 'delete').mockResolvedValue(mockResult);

    const res = await controller.delete('q-123', 'user-id', 'user');
    expect(res).toBe(mockResult);
    expect(spy).toHaveBeenCalledWith('q-123', 'user-id', false);
  });
});
