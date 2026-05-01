import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';

const ACCESS_COOKIE = 'access_token';

@Injectable()
export class JwtCookieGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const token = (req.cookies?.[ACCESS_COOKIE] as string | undefined) ?? '';
    this.auth.verifyAccessToken(token);
    return true;
  }
}

