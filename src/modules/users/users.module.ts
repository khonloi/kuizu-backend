import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import {
  UserProgress,
  UserProgressSchema,
} from '../courses/schemas/user-progress.schema';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AdminUsersController } from './admin-users.controller';
import { UserRepository } from './repositories';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserProgress.name, schema: UserProgressSchema },
    ]),
    GamificationModule,
  ],
  controllers: [UsersController, AdminUsersController],
  providers: [UsersService, UserRepository],
  exports: [UsersService, UserRepository, GamificationModule],
})
export class UsersModule {}
