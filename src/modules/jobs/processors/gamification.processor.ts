import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { LeagueCalculationPayload } from '../dto/job-payloads.dto';
import { UserRepository } from '../../users/repositories';

export const LEAGUE_TIERS = [
  'bronze',
  'silver',
  'gold',
  'sapphire',
  'ruby',
  'diamond',
] as const;

export type LeagueTier = (typeof LEAGUE_TIERS)[number];

@Processor('gamification-queue')
export class GamificationProcessor extends WorkerHost {
  private readonly logger = new Logger(GamificationProcessor.name);

  constructor(private readonly userRepository: UserRepository) {
    super();
  }

  async process(
    job: Job<any, any, string>,
  ): Promise<{ promoted: number; demoted: number; evaluated: number }> {
    this.logger.debug(
      `Processing gamification job '${job.name}' (id: ${job.id})`,
    );

    switch (job.name) {
      case 'calculate-league-standings':
        return this.handleLeagueCalculation(
          job.data as LeagueCalculationPayload,
        );
      default:
        this.logger.warn(`Unknown job name in gamification-queue: ${job.name}`);
        return { promoted: 0, demoted: 0, evaluated: 0 };
    }
  }

  async handleLeagueCalculation(
    _data: LeagueCalculationPayload,
  ): Promise<{ promoted: number; demoted: number; evaluated: number }> {
    this.logger.log('Starting league standings calculation and adjustments...');

    let promotedCount = 0;
    let demotedCount = 0;
    let totalEvaluated = 0;

    for (let i = 0; i < LEAGUE_TIERS.length; i++) {
      const currentTier = LEAGUE_TIERS[i];
      const nextTier = LEAGUE_TIERS[i + 1] as LeagueTier | undefined;
      const prevTier = LEAGUE_TIERS[i - 1] as LeagueTier | undefined;

      const usersInTier = await this.userRepository.find(
        { league: currentTier, isActive: true },
        null,
        { sort: { xp: -1 } },
      );

      totalEvaluated += usersInTier.length;

      if (usersInTier.length < 5) {
        // Not enough participants in this tier to partition for promotion/demotion
        continue;
      }

      // Top 20% are promoted (if not at highest tier)
      if (nextTier) {
        const promoteThreshold = Math.max(
          1,
          Math.floor(usersInTier.length * 0.2),
        );
        const toPromote = usersInTier.slice(0, promoteThreshold);

        for (const user of toPromote) {
          await this.userRepository.findByIdAndUpdate(user._id.toString(), {
            league: nextTier,
          });
          promotedCount++;
        }
      }

      // Bottom 20% are demoted (if not at lowest tier 'bronze')
      if (prevTier) {
        const demoteThreshold = Math.max(
          1,
          Math.floor(usersInTier.length * 0.2),
        );
        const toDemote = usersInTier.slice(
          usersInTier.length - demoteThreshold,
        );

        for (const user of toDemote) {
          await this.userRepository.findByIdAndUpdate(user._id.toString(), {
            league: prevTier,
          });
          demotedCount++;
        }
      }
    }

    this.logger.log(
      `League calculation completed: Evaluated=${totalEvaluated}, Promoted=${promotedCount}, Demoted=${demotedCount}`,
    );

    return {
      promoted: promotedCount,
      demoted: demotedCount,
      evaluated: totalEvaluated,
    };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Gamification job ${job.id} completed successfully.`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(
      `Gamification job ${job.id} failed: ${err.message}`,
      err.stack,
    );
  }

  @OnWorkerEvent('error')
  onError(err: Error) {
    this.logger.error(`Gamification queue worker error: ${err.message}`);
  }
}
