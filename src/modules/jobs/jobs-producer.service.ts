import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RedisService } from '../../common/redis/redis.service';
import {
  VerificationEmailPayload,
  PasswordResetEmailPayload,
  GameSessionReportPayload,
  LeagueCalculationPayload,
} from './dto/job-payloads.dto';
import { EmailProcessor } from './processors/email.processor';
import { GameReportsProcessor } from './processors/game-reports.processor';
import { GamificationProcessor } from './processors/gamification.processor';

@Injectable()
export class JobsProducerService {
  private readonly logger = new Logger(JobsProducerService.name);

  constructor(
    @InjectQueue('email-queue') private readonly emailQueue: Queue,
    @InjectQueue('game-reports-queue') private readonly gameReportsQueue: Queue,
    @InjectQueue('gamification-queue')
    private readonly gamificationQueue: Queue,
    private readonly redisService: RedisService,
    private readonly emailProcessor: EmailProcessor,
    private readonly gameReportsProcessor: GameReportsProcessor,
    private readonly gamificationProcessor: GamificationProcessor,
  ) {}

  async sendVerificationEmail(
    payload: VerificationEmailPayload,
  ): Promise<void> {
    if (this.redisService.isAvailable()) {
      try {
        await this.emailQueue.add('send-verification-email', payload, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          removeOnFail: false,
        });
        this.logger.debug(
          `Enqueued verification email to ${payload.to} on email-queue`,
        );
        return;
      } catch (err: any) {
        this.logger.warn(
          `Failed to enqueue verification email (${err.message}). Executing in-process fallback.`,
        );
      }
    }

    // In-process fallback when Redis is offline
    await this.emailProcessor.handleVerificationEmail(payload);
  }

  async sendPasswordResetEmail(
    payload: PasswordResetEmailPayload,
  ): Promise<void> {
    if (this.redisService.isAvailable()) {
      try {
        await this.emailQueue.add('send-password-reset-email', payload, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          removeOnFail: false,
        });
        this.logger.debug(
          `Enqueued password reset email to ${payload.to} on email-queue`,
        );
        return;
      } catch (err: any) {
        this.logger.warn(
          `Failed to enqueue password reset email (${err.message}). Executing in-process fallback.`,
        );
      }
    }

    // In-process fallback when Redis is offline
    await this.emailProcessor.handlePasswordResetEmail(payload);
  }

  async saveGameSessionReport(
    payload: GameSessionReportPayload,
  ): Promise<void> {
    if (this.redisService.isAvailable()) {
      try {
        await this.gameReportsQueue.add('save-game-session', payload, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
          removeOnFail: false,
        });
        this.logger.debug(
          `Enqueued game session report PIN: ${payload.pin} on game-reports-queue`,
        );
        return;
      } catch (err: any) {
        this.logger.warn(
          `Failed to enqueue game session report (${err.message}). Executing in-process fallback.`,
        );
      }
    }

    // In-process fallback when Redis is offline
    await this.gameReportsProcessor.handleSaveGameSession(payload);
  }

  async calculateLeagueStandings(
    payload: LeagueCalculationPayload = {},
  ): Promise<void> {
    if (this.redisService.isAvailable()) {
      try {
        await this.gamificationQueue.add(
          'calculate-league-standings',
          payload,
          {
            attempts: 2,
            removeOnComplete: true,
            removeOnFail: false,
          },
        );
        this.logger.debug('Enqueued league calculation on gamification-queue');
        return;
      } catch (err: any) {
        this.logger.warn(
          `Failed to enqueue league calculation (${err.message}). Executing in-process fallback.`,
        );
      }
    }

    // In-process fallback when Redis is offline
    await this.gamificationProcessor.handleLeagueCalculation(payload);
  }
}
