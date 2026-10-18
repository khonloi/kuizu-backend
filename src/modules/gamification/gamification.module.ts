import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { GamificationRepository } from './repositories';
import { GamificationService } from './gamification.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [GamificationService, GamificationRepository],
  exports: [GamificationService, GamificationRepository],
})
export class GamificationModule {}
