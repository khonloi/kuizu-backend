import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { AuditLogRepository } from './repositories/audit-log.repository';
import { AuditLogDocument } from './schemas/audit-log.schema';

export interface LogActionParams {
  userId?: string | Types.ObjectId;
  userEmail?: string;
  action: string;
  targetEntity: string;
  targetId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  async logAction(params: LogActionParams): Promise<AuditLogDocument | null> {
    try {
      const userObjectId =
        params.userId && Types.ObjectId.isValid(String(params.userId))
          ? new Types.ObjectId(String(params.userId))
          : undefined;

      const log = await this.auditLogRepository.create({
        userId: userObjectId,
        userEmail: params.userEmail,
        action: params.action,
        targetEntity: params.targetEntity,
        targetId: params.targetId,
        details: params.details || {},
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });

      const actor =
        params.userEmail ?? (params.userId ? String(params.userId) : 'system');
      this.logger.log(
        `[AUDIT] Action: ${params.action} on ${params.targetEntity}:${params.targetId ?? 'global'} by ${actor}`,
      );

      return log;
    } catch (err: any) {
      this.logger.error(
        `Failed to record audit log: ${err.message}`,
        err.stack,
      );
      return null;
    }
  }

  async getRecentLogs(limit = 50): Promise<AuditLogDocument[]> {
    return this.auditLogRepository.findRecent(limit);
  }

  async getLogsForEntity(
    targetEntity: string,
    targetId?: string,
  ): Promise<AuditLogDocument[]> {
    return this.auditLogRepository.findByEntity(targetEntity, targetId);
  }
}
