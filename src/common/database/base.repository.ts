import {
  Model,
  QueryFilter,
  UpdateQuery,
  QueryOptions,
  ProjectionType,
  Types,
} from 'mongoose';

export abstract class BaseRepository<T> {
  constructor(protected readonly model: Model<T>) {}

  getModel(): Model<T> {
    return this.model;
  }

  protected async executeQuery<R>(query: any): Promise<R> {
    if (query && typeof query.exec === 'function') {
      return query.exec();
    }
    return query;
  }

  async create(doc: Partial<T> | Record<string, unknown>): Promise<T> {
    const createdEntity = new this.model(doc);
    return (await createdEntity.save()) as unknown as T;
  }

  async findById(
    id: string | Types.ObjectId,
    projection?: ProjectionType<T> | null,
    options?: QueryOptions<T>,
  ): Promise<T | null> {
    if (projection !== undefined || options !== undefined) {
      return this.executeQuery(this.model.findById(id, projection, options));
    }
    return this.executeQuery(this.model.findById(id));
  }

  async findOne(
    filter: QueryFilter<T>,
    projection?: ProjectionType<T> | null,
    options?: QueryOptions<T>,
  ): Promise<T | null> {
    if (projection !== undefined || options !== undefined) {
      return this.executeQuery(this.model.findOne(filter, projection, options));
    }
    return this.executeQuery(this.model.findOne(filter));
  }

  async find(
    filter: QueryFilter<T> = {},
    projection?: ProjectionType<T> | null,
    options?: QueryOptions<T>,
  ): Promise<T[]> {
    if (projection !== undefined || options !== undefined) {
      return this.executeQuery(this.model.find(filter, projection, options));
    }
    return this.executeQuery(this.model.find(filter));
  }

  async findByIdAndUpdate(
    id: string | Types.ObjectId,
    update: UpdateQuery<T>,
    options: QueryOptions<T> = { new: true },
  ): Promise<T | null> {
    return this.executeQuery(this.model.findByIdAndUpdate(id, update, options));
  }

  async findOneAndUpdate(
    filter: QueryFilter<T>,
    update: UpdateQuery<T>,
    options: QueryOptions<T> = { new: true },
  ): Promise<T | null> {
    return this.executeQuery(
      this.model.findOneAndUpdate(filter, update, options),
    );
  }

  async findByIdAndDelete(
    id: string | Types.ObjectId,
    options?: QueryOptions<T>,
  ): Promise<T | null> {
    if (options !== undefined) {
      return this.executeQuery(this.model.findByIdAndDelete(id, options));
    }
    return this.executeQuery(this.model.findByIdAndDelete(id));
  }

  async deleteMany(filter: QueryFilter<T>): Promise<{ deletedCount?: number }> {
    return this.executeQuery(this.model.deleteMany(filter));
  }

  async countDocuments(filter: QueryFilter<T> = {}): Promise<number> {
    return this.executeQuery(this.model.countDocuments(filter));
  }
}
