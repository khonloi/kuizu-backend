import { describe, it, expect, vi } from 'vitest';
import { sanitizeQuestion, sanitizeQuiz } from './quiz-sanitizer.util';

describe('quiz-sanitizer.util', () => {
  describe('sanitizeQuestion', () => {
    it('should return null or undefined if passed null or undefined', () => {
      expect(sanitizeQuestion(null)).toBeNull();
      expect(sanitizeQuestion(undefined)).toBeUndefined();
    });

    it('should strip isCorrect from choices array on plain object', () => {
      const question = {
        _id: 'q1',
        questionText: 'What is NestJS?',
        choices: [
          { text: 'A framework', isCorrect: true, order: 1 },
          { text: 'A database', isCorrect: false, order: 2 },
        ],
      };

      const result: any = sanitizeQuestion(question);
      expect(result._id).toBe('q1');
      expect(result.questionText).toBe('What is NestJS?');
      expect(result.choices).toHaveLength(2);
      expect(result.choices[0]).toEqual({ text: 'A framework', order: 1 });
      expect(result.choices[1]).toEqual({ text: 'A database', order: 2 });
      expect(result.choices[0].isCorrect).toBeUndefined();
      expect(result.choices[1].isCorrect).toBeUndefined();
    });

    it('should call toObject if available on question', () => {
      const mockDoc = {
        toObject: vi.fn().mockReturnValue({
          _id: 'q2',
          choices: [{ text: 'Option A', isCorrect: true }],
        }),
      };

      const result: any = sanitizeQuestion(mockDoc);
      expect(mockDoc.toObject).toHaveBeenCalled();
      expect(result.choices[0]).toEqual({ text: 'Option A' });
      expect(result.choices[0].isCorrect).toBeUndefined();
    });

    it('should handle question with no choices', () => {
      const question = { _id: 'q3', questionText: 'Open question' };
      const result: any = sanitizeQuestion(question);
      expect(result).toEqual(question);
    });
  });

  describe('sanitizeQuiz', () => {
    it('should return null or undefined if passed null or undefined', () => {
      expect(sanitizeQuiz(null)).toBeNull();
      expect(sanitizeQuiz(undefined)).toBeUndefined();
    });

    it('should sanitize nested questions and choices in a quiz', () => {
      const quiz = {
        _id: 'quiz1',
        title: 'TypeScript Quiz',
        questions: [
          {
            _id: 'q1',
            choices: [
              { text: 'Choice 1', isCorrect: true },
              { text: 'Choice 2', isCorrect: false },
            ],
          },
          {
            _id: 'q2',
            choices: [{ text: 'Choice 3', isCorrect: true }],
          },
        ],
      };

      const result: any = sanitizeQuiz(quiz);
      expect(result._id).toBe('quiz1');
      expect(result.title).toBe('TypeScript Quiz');
      expect(result.questions).toHaveLength(2);
      expect(result.questions[0].choices[0].isCorrect).toBeUndefined();
      expect(result.questions[0].choices[1].isCorrect).toBeUndefined();
      expect(result.questions[1].choices[0].isCorrect).toBeUndefined();
    });

    it('should call toObject if available on quiz and its nested questions', () => {
      const mockQuizDoc = {
        toObject: vi.fn().mockReturnValue({
          _id: 'quiz2',
          questions: [
            {
              toObject: vi.fn().mockReturnValue({
                _id: 'q1',
                choices: [{ text: 'Choice', isCorrect: true }],
              }),
            },
          ],
        }),
      };

      const result: any = sanitizeQuiz(mockQuizDoc);
      expect(mockQuizDoc.toObject).toHaveBeenCalled();
      expect(result.questions[0].choices[0].isCorrect).toBeUndefined();
    });

    it('should handle quiz with no questions array', () => {
      const quiz = { _id: 'quiz3', title: 'Empty Quiz' };
      const result: any = sanitizeQuiz(quiz);
      expect(result).toEqual(quiz);
    });
  });
});
