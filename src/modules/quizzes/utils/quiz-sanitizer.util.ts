/**
 * Sanitizes question objects by stripping `isCorrect` from choices for public/learner views.
 */
export function sanitizeQuestion<T = Record<string, unknown>>(
  question: unknown,
): T {
  if (!question || typeof question !== 'object') return question as T;
  const raw = question as Record<string, unknown> & {
    toObject?: () => Record<string, unknown>;
  };
  const qObj = typeof raw.toObject === 'function' ? raw.toObject() : { ...raw };

  if (Array.isArray(qObj.choices)) {
    qObj.choices = qObj.choices.map((c: unknown) => {
      if (c && typeof c === 'object') {
        const { isCorrect: _isCorrect, ...rest } = c as Record<string, unknown>;
        return rest;
      }
      return c;
    });
  }

  return qObj as T;
}

/**
 * Sanitizes quiz objects including nested populated questions and their choices.
 */
export function sanitizeQuiz<T = Record<string, unknown>>(quiz: unknown): T {
  if (!quiz || typeof quiz !== 'object') return quiz as T;
  const raw = quiz as Record<string, unknown> & {
    toObject?: () => Record<string, unknown>;
  };
  const quizObj =
    typeof raw.toObject === 'function' ? raw.toObject() : { ...raw };

  if (Array.isArray(quizObj.questions)) {
    quizObj.questions = quizObj.questions.map((q: unknown) =>
      sanitizeQuestion(q),
    );
  }

  return quizObj as T;
}
