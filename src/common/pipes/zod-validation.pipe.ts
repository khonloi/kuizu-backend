import { PipeTransform, ArgumentMetadata, BadRequestException, Injectable, Optional } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(@Optional() private schema?: ZodSchema<any>) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    if (!this.schema) {
      return value;
    }
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const error = result.error as ZodError;
      const formattedErrors = (error.issues || []).map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        errors: formattedErrors,
      });
    }
    return result.data;
  }
}
