import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserData {
  id: string;
  email: string;
  username: string;
  role: string;
}

export function getCurrentUserFromContext(
  data: keyof CurrentUserData | undefined,
  ctx: ExecutionContext,
): unknown {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user as CurrentUserData | undefined;
  if (!user) return null;
  return data ? user[data] : user;
}

export const CurrentUser = createParamDecorator(getCurrentUserFromContext);
