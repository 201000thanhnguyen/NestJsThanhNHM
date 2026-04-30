import { Injectable, UnauthorizedException } from '@nestjs/common';
import jwt, { JwtPayload } from 'jsonwebtoken';

export type AuthUser = {
  username: string;
};

@Injectable()
export class AuthService {
  private get jwtSecret(): string {
    return process.env.JWT_SECRET ?? 'dev_secret_change_me';
  }

  private get expectedUsername(): string {
    return process.env.AUTH_USER ?? 'admin';
  }

  private get expectedPassword(): string {
    return process.env.AUTH_PASS ?? '24062008';
  }

  validateCredentials(username: string, password: string): AuthUser {
    if (username !== this.expectedUsername || password !== this.expectedPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return { username };
  }

  signAccessToken(user: AuthUser): string {
    return jwt.sign(
      { sub: user.username, username: user.username },
      this.jwtSecret,
      { expiresIn: '7d' },
    );
  }

  verifyAccessToken(token: string): AuthUser {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as JwtPayload;
      const username = typeof payload.username === 'string' ? payload.username : undefined;
      if (!username) throw new Error('Missing username');
      return { username };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}

