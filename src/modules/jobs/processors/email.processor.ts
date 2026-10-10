import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  VerificationEmailPayload,
  PasswordResetEmailPayload,
} from '../dto/job-payloads.dto';

@Processor('email-queue')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  async process(
    job: Job<any, any, string>,
  ): Promise<{ sent: boolean; type: string }> {
    this.logger.debug(`Processing email job '${job.name}' (id: ${job.id})`);

    switch (job.name) {
      case 'send-verification-email':
        return this.handleVerificationEmail(
          job.data as VerificationEmailPayload,
        );
      case 'send-password-reset-email':
        return this.handlePasswordResetEmail(
          job.data as PasswordResetEmailPayload,
        );
      default:
        this.logger.warn(`Unknown job name in email-queue: ${job.name}`);
        return { sent: false, type: job.name };
    }
  }

  async handleVerificationEmail(
    data: VerificationEmailPayload,
  ): Promise<{ sent: boolean; type: string }> {
    this.logger.log(
      `[EmailService] Sending email verification to ${data.to} (user: ${data.username}). Token: ${data.token.slice(0, 8)}...`,
    );
    // Simulated async email delivery (e.g. via SendGrid, Resend, or SMTP)
    return { sent: true, type: 'verification' };
  }

  async handlePasswordResetEmail(
    data: PasswordResetEmailPayload,
  ): Promise<{ sent: boolean; type: string }> {
    this.logger.log(
      `[EmailService] Sending password reset link to ${data.to} (user: ${data.username}). Token: ${data.token.slice(0, 8)}...`,
    );
    // Simulated async email delivery
    return { sent: true, type: 'password-reset' };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Email job ${job.id} completed successfully.`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Email job ${job.id} failed: ${err.message}`, err.stack);
  }

  @OnWorkerEvent('error')
  onError(err: Error) {
    this.logger.error(`Email queue worker error: ${err.message}`);
  }
}
