import {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';

/**
 * Thin TypeORM wrapper so services stay focused on business logic.
 * Extend per-entity repositories in each module's repositories/ folder.
 */
export abstract class BaseRepository<T extends { id: string | number }> {
  protected constructor(protected readonly repository: Repository<T>) {}

  create(data: DeepPartial<T>): T {
    return this.repository.create(data);
  }

  save(entity: DeepPartial<T>): Promise<T> {
    return this.repository.save(entity);
  }

  findOne(options: FindOneOptions<T>): Promise<T | null> {
    return this.repository.findOne(options);
  }

  find(options?: FindManyOptions<T>): Promise<T[]> {
    return this.repository.find(options);
  }

  findAndCount(options?: FindManyOptions<T>): Promise<[T[], number]> {
    return this.repository.findAndCount(options);
  }

  update(criteria: FindOptionsWhere<T>, data: DeepPartial<T>) {
    return this.repository.update(
      criteria,
      data as Parameters<Repository<T>['update']>[1],
    );
  }

  softRemove(entity: T): Promise<T> {
    return this.repository.softRemove(entity);
  }

  delete(criteria: FindOptionsWhere<T>) {
    return this.repository.delete(criteria);
  }
}
