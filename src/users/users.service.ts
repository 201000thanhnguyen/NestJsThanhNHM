import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from './user.entity';

const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = '24062008';
const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async findByUsername(username: string): Promise<User | null> {
    return await this.users.findOne({ where: { username } });
  }

  async countUsers(): Promise<number> {
    return await this.users.count();
  }

  async createUser(username: string, plainPassword: string): Promise<User> {
    const password = await bcrypt.hash(plainPassword, BCRYPT_SALT_ROUNDS);
    const user = this.users.create({ username, password });
    return await this.users.save(user);
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.ensureDefaultAdminIfEmpty();
  }

  private async ensureDefaultAdminIfEmpty(): Promise<void> {
    const count = await this.countUsers();
    if (count > 0) return;

    this.logger.warn(
      `No users found. Creating default admin user "${DEFAULT_ADMIN_USERNAME}".`,
    );

    await this.createUser(DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD);
  }
}

