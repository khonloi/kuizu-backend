import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

@Schema({ timestamps: true, collection: 'audit_logs' })
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  userId?: Types.ObjectId;

  @Prop({ type: String, required: false })
  userEmail?: string;

  @Prop({ type: String, required: true, index: true })
  action: string;

  @Prop({ type: String, required: true, index: true })
  targetEntity: string;

  @Prop({ type: String, required: false, index: true })
  targetId?: string;

  @Prop({ type: Object, default: {} })
  details: Record<string, any>;

  @Prop({ type: String, required: false })
  ipAddress?: string;

  @Prop({ type: String, required: false })
  userAgent?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ targetEntity: 1, targetId: 1 });
