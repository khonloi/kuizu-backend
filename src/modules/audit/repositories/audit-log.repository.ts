import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter } from 'mongoose';
import { BaseRepository } from '../../../common/database';
import { AuditLog, AuditLogDocument } from '../schemas/audit-log.schema';

@Injectable()
export class AuditLogRepository extends BaseRepository<AuditLogDocument> {
  constructor(
    @InjectModel(AuditLog.name)
    auditLogModel: Model<AuditLogDocument>,
  ) {
    super(auditLogModel);
  }

  async findRecent(limit = 50): Promise<AuditLogDocument[]> {
    return this.model.find().sort({ createdAt: -1 }).limit(limit).exec();
  }

  async findByEntity(
    targetEntity: string,
    targetId?: string,
  ): Promise<AuditLogDocument[]> {
    const filter: QueryFilter<AuditLogDocument> = { targetEntity };
    if (targetId) {
      filter.targetId = targetId;
    }
    return this.model.find(filter).sort({ createdAt: -1 }).exec();
  }
}
