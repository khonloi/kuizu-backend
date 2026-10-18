import {
  Model,
  QueryFilter,
  UpdateQuery,
  QueryOptions,
  ProjectionType,
  Types,
  ClientSession,
} from 'mongoose';
import {
  PaginationQueryInputDto,
  PaginatedResponse,
  createOffsetPaginatedResponse,
  createCursorPaginatedResponse,
} from '../dto/pagination.dto';
import { escapeRegex } from '../utils/regex.util';
import { PAGINATION_CONSTANTS } from '../constants';

export interface PaginateOptions<T> {
  searchFields?: string[];
  allowedSortFields?: Set<string> | string[];
  defaultSortField?: string;
  defaultSortOrder?: 'asc' | 'desc';
  populate?: any[];
  projection?: ProjectionType<T> | null;
}

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

  async softDelete(
    id: string | Types.ObjectId,
    deletedBy?: string,
  ): Promise<T | null> {
    const update: any = {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        ...(deletedBy ? { deletedBy } : {}),
      },
    };
    return this.executeQuery(
      this.model.findByIdAndUpdate(id, update, { new: true }),
    );
  }

  async restore(id: string | Types.ObjectId): Promise<T | null> {
    const update: any = {
      $set: {
        isDeleted: false,
        deletedAt: null,
      },
      $unset: {
        deletedBy: 1,
      },
    };
    return this.executeQuery(
      this.model.findByIdAndUpdate(id, update, { new: true }),
    );
  }

  async deleteMany(filter: QueryFilter<T>): Promise<{ deletedCount?: number }> {
    return this.executeQuery(this.model.deleteMany(filter));
  }

  async countDocuments(filter: QueryFilter<T> = {}): Promise<number> {
    return this.executeQuery(this.model.countDocuments(filter));
  }

  async findLean<R = T>(
    filter: QueryFilter<T> = {},
    projection?: ProjectionType<T> | null,
    options?: QueryOptions<T>,
  ): Promise<R[]> {
    const query = this.model.find(filter, projection, options).lean();
    return this.executeQuery(query);
  }

  async findOneLean<R = T>(
    filter: QueryFilter<T>,
    projection?: ProjectionType<T> | null,
    options?: QueryOptions<T>,
  ): Promise<R | null> {
    const query = this.model.findOne(filter, projection, options).lean();
    return this.executeQuery(query);
  }

  async findByIdLean<R = T>(
    id: string | Types.ObjectId,
    projection?: ProjectionType<T> | null,
    options?: QueryOptions<T>,
  ): Promise<R | null> {
    const query = this.model.findById(id, projection, options).lean();
    return this.executeQuery(query);
  }

  async withTransaction<R>(
    fn: (session: ClientSession) => Promise<R>,
  ): Promise<R> {
    const session = await this.model.db.startSession();
    try {
      let result!: R;
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  async paginate<R = T>(
    filter: QueryFilter<T> = {},
    query: PaginationQueryInputDto = {},
    options: PaginateOptions<T> = {},
  ): Promise<PaginatedResponse<R>> {
    const mongoFilter: Record<string, unknown> = {
      ...(filter as Record<string, unknown>),
    };
    const limit =
      Number(query.limit) > 0
        ? Number(query.limit)
        : PAGINATION_CONSTANTS.DEFAULT_LIMIT;
    const isCursorMode = query.mode === 'cursor' || Boolean(query.cursor);

    if (
      query.search &&
      query.search.trim() &&
      options.searchFields &&
      options.searchFields.length > 0
    ) {
      const term = escapeRegex(query.search.trim());
      mongoFilter.$or = options.searchFields.map((field) => ({
        [field]: { $regex: term, $options: 'i' },
      }));
    }

    const applyPopulate = (findQuery: any) => {
      if (options.populate && Array.isArray(options.populate)) {
        for (const pop of options.populate) {
          if (Array.isArray(pop)) {
            findQuery = findQuery.populate(...pop);
          } else {
            findQuery = findQuery.populate(pop);
          }
        }
      }
      return findQuery;
    };

    if (isCursorMode) {
      if (query.cursor && Types.ObjectId.isValid(query.cursor)) {
        mongoFilter._id = { $lt: new Types.ObjectId(query.cursor) };
      }
      let findQuery = this.model
        .find(mongoFilter, options.projection)
        .sort({ _id: -1 })
        .limit(limit + 1);

      findQuery = applyPopulate(findQuery);
      const items = (await this.executeQuery(findQuery)) as R[];

      return createCursorPaginatedResponse(
        items as any,
        limit,
      ) as unknown as PaginatedResponse<R>;
    }

    const page =
      Number(query.page) > 0
        ? Number(query.page)
        : PAGINATION_CONSTANTS.DEFAULT_PAGE;
    const skip = (page - 1) * limit;

    const allowedSort = options.allowedSortFields
      ? options.allowedSortFields instanceof Set
        ? options.allowedSortFields
        : new Set(options.allowedSortFields)
      : null;

    const defaultSortField = options.defaultSortField || 'createdAt';
    const sortField =
      query.sortBy && (!allowedSort || allowedSort.has(query.sortBy))
        ? query.sortBy
        : defaultSortField;

    const defaultDirection = options.defaultSortOrder === 'asc' ? 1 : -1;
    const sortDirection = query.sortOrder
      ? query.sortOrder === 'asc'
        ? 1
        : -1
      : defaultDirection;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDirection };

    let findQuery = this.model
      .find(mongoFilter, options.projection)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    findQuery = applyPopulate(findQuery);

    const [total, data] = await Promise.all([
      this.model.countDocuments(mongoFilter).exec(),
      this.executeQuery<R[]>(findQuery),
    ]);

    return createOffsetPaginatedResponse(data, total, page, limit);
  }
}
