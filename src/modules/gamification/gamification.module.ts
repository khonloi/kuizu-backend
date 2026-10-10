import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UserRepository } from '../users/repositories';
import { GamificationService } from './gamification.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [GamificationService, UserRepository],
  exports: [GamificationService],
})
export class GamificationModule {}
