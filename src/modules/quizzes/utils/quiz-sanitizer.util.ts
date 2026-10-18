/**
 * Sanitizes question objects by stripping `isCorrect` from choices for public/learner views.
 */
export function sanitizeQuestion<T = Record<string, unknown>>(
  question: any,
): T {
  if (!question) return question;
  const qObj =
    typeof question.toObject === 'function'
      ? question.toObject()
      : { ...question };

  if (Array.isArray(qObj.choices)) {
    qObj.choices = qObj.choices.map((c: any) => {
      const { isCorrect: _isCorrect, ...rest } = c;
      return rest;
    });
  }

  return qObj;
}

/**
 * Sanitizes quiz objects including nested populated questions and their choices.
 */
export function sanitizeQuiz<T = Record<string, unknown>>(quiz: any): T {
  if (!quiz) return quiz;
  const quizObj =
    typeof quiz.toObject === 'function' ? quiz.toObject() : { ...quiz };

  if (Array.isArray(quizObj.questions)) {
    quizObj.questions = quizObj.questions.map((q: any) => sanitizeQuestion(q));
  }

  return quizObj;
}
