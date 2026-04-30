import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

const ACCESS_COOKIE = 'access_token';

function isSecureCookie(): boolean {
  return (process.env.COOKIE_SECURE ?? '').toLowerCase() === 'true';
}

@Controller(['auth', 'api/auth'])
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = this.auth.validateCredentials(body.username, body.password);
    const token = this.auth.signAccessToken(user);

    res.cookie(ACCESS_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecureCookie(),
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { ok: true, user };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  me(@Req() req: Request) {
    const token = (req.cookies?.[ACCESS_COOKIE] as string | undefined) ?? '';
    const user = this.auth.verifyAccessToken(token);
    return { ok: true, user };
  }
}

