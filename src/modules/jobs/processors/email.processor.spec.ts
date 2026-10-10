import { describe, it, expect, beforeEach } from 'vitest';
import { EmailProcessor } from './email.processor';

describe('EmailProcessor', () => {
  let processor: EmailProcessor;

  beforeEach(() => {
    processor = new EmailProcessor();
  });

  it('should process send-verification-email job', async () => {
    const job = {
      id: 'job-1',
      name: 'send-verification-email',
      data: {
        to: 'user@example.com',
        username: 'UserOne',
        token: 'verify-123456789',
      },
    } as any;

    const result = await processor.process(job);
    expect(result).toEqual({ sent: true, type: 'verification' });
  });

  it('should process send-password-reset-email job', async () => {
    const job = {
      id: 'job-2',
      name: 'send-password-reset-email',
      data: {
        to: 'user@example.com',
        username: 'UserOne',
        token: 'reset-123456789',
      },
    } as any;

    const result = await processor.process(job);
    expect(result).toEqual({ sent: true, type: 'password-reset' });
  });

  it('should handle unknown job gracefully', async () => {
    const job = {
      id: 'job-3',
      name: 'unknown-email-job',
      data: {},
    } as any;

    const result = await processor.process(job);
    expect(result).toEqual({ sent: false, type: 'unknown-email-job' });
  });

  it('should execute direct handler methods for verification and password reset', async () => {
    const resVerify = await processor.handleVerificationEmail({
      to: 'direct@example.com',
      username: 'DirectUser',
      token: 'token-abc',
    });
    expect(resVerify).toEqual({ sent: true, type: 'verification' });

    const resReset = await processor.handlePasswordResetEmail({
      to: 'direct@example.com',
      username: 'DirectUser',
      token: 'token-xyz',
    });
    expect(resReset).toEqual({ sent: true, type: 'password-reset' });
  });
});
