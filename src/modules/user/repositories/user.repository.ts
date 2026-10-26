import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/base/base.repository';
import { User } from '../entities/user.entity';

@Injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(
    @InjectRepository(User)
    repository: Repository<User>,
  ) {
    super(repository);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({
      where: { email },
      relations: {
        client: true,
        customRole: {
          rolePermissions: {
            module: true,
          },
        },
      },
    });
  }

  findByIdWithRelations(id: string): Promise<User | null> {
    return this.repository.findOne({
      where: { id },
      relations: {
        client: true,
        customRole: {
          rolePermissions: {
            module: true,
          },
        },
      },
    });
  }
}
