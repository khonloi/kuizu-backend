import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!value || !Types.ObjectId.isValid(value)) {
      throw new BadRequestException(
        `Invalid ID parameter: '${value}' is not a valid Mongo ObjectId`,
      );
    }
    return value;
  }
}
