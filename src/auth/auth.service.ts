import { Injectable, UnauthorizedException } from '@nestjs/common';
import jwt, { JwtPayload } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

export type AppRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER';

export type AuthUser = {
  id: number;
  username: string;
};

/** Role for JWT until a DB column exists. Extend mapping as needed. */
export function resolveRoleForUsername(username: string): AppRole {
  const u = username.trim().toLowerCase();
  if (u === 'admin') return 'SUPER_ADMIN';
  if (u === 'manager') return 'ADMIN';
  return 'USER';
}

@Injectable()
export class AuthService {
  constructor(private readonly users: UsersService) {}

  private get jwtSecret(): string {
    return process.env.JWT_SECRET ?? 'dev_secret_change_me';
  }

  async validateCredentials(username: string, password: string): Promise<AuthUser> {
    const user = await this.users.findByUsername(username);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return { id: user.id, username: user.username };
  }

  signAccessToken(user: AuthUser): string {
    const role = resolveRoleForUsername(user.username);
    return jwt.sign(
      { sub: user.id, username: user.username, role },
      this.jwtSecret,
      { expiresIn: '7d' },
    );
  }

  verifyAccessToken(token: string): Pick<AuthUser, 'username'> & { role: AppRole } {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as JwtPayload;
      const username =
        typeof payload.username === 'string' ? payload.username : undefined;
      if (!username) throw new Error('Missing username');
      const rawRole = payload.role;
      const role: AppRole =
        rawRole === 'SUPER_ADMIN' || rawRole === 'ADMIN' || rawRole === 'USER'
          ? rawRole
          : resolveRoleForUsername(username);
      return { username, role };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
