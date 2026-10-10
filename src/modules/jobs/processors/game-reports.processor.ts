import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Types } from 'mongoose';
import { GameSessionReportPayload } from '../dto/job-payloads.dto';
import { GameSessionRepository } from '../../games/repositories';
import { QuizRepository } from '../../quizzes/repositories';

@Processor('game-reports-queue')
export class GameReportsProcessor extends WorkerHost {
  private readonly logger = new Logger(GameReportsProcessor.name);

  constructor(
    private readonly gameSessionRepository: GameSessionRepository,
    private readonly quizRepository: QuizRepository,
  ) {
    super();
  }

  async process(
    job: Job<any, any, string>,
  ): Promise<{ saved: boolean; pin: string }> {
    this.logger.debug(
      `Processing game report job '${job.name}' (id: ${job.id})`,
    );

    switch (job.name) {
      case 'save-game-session':
        return this.handleSaveGameSession(job.data as GameSessionReportPayload);
      default:
        this.logger.warn(`Unknown job name in game-reports-queue: ${job.name}`);
        return { saved: false, pin: '' };
    }
  }

  async handleSaveGameSession(
    data: GameSessionReportPayload,
  ): Promise<{ saved: boolean; pin: string }> {
    try {
      const hostObjectId =
        data.hostUserId && Types.ObjectId.isValid(data.hostUserId)
          ? new Types.ObjectId(data.hostUserId)
          : null;

      if (Types.ObjectId.isValid(data.quizId)) {
        await this.gameSessionRepository.create({
          pin: data.pin,
          host: hostObjectId,
          quiz: new Types.ObjectId(data.quizId),
          quizTitle: data.quizTitle,
          players: data.players.map((p) => ({
            nickname: p.nickname,
            score: p.score,
            rank: p.rank,
          })),
          status: 'completed',
        });

        await this.quizRepository.incrementPlayCount(data.quizId);
        this.logger.log(
          `[GameReports] Successfully persisted game session PIN: ${data.pin} with ${data.players.length} players.`,
        );
        return { saved: true, pin: data.pin };
      }

      this.logger.warn(
        `[GameReports] Invalid quizId ${data.quizId} for PIN: ${data.pin}`,
      );
      return { saved: false, pin: data.pin };
    } catch (err: any) {
      this.logger.error(
        `[GameReports] Failed to persist game session ${data.pin}: ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Game report job ${job.id} completed successfully.`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(
      `Game report job ${job.id} failed: ${err.message}`,
      err.stack,
    );
  }

  @OnWorkerEvent('error')
  onError(err: Error) {
    this.logger.error(`Game reports queue worker error: ${err.message}`);
  }
}
