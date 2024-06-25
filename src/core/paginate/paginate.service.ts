import { ZodError } from 'nestjs-zod/z';
import { Injectable } from '@nestjs/common';
import { z } from 'nestjs-zod/z';
import {
  type ObjectLiteral,
  Repository,
  type FindOptionsWhere,
  type FindManyOptions,
  //   SelectQueryBuilder,
} from 'typeorm';
import { BadRequestError } from '@/common/interceptors/badRequestError.interceptor';

const paginationParamSchema = z
  .union([z.string(), z.number()])
  .refine(value => {
    if (value) {
      if (typeof value === 'string') {
        const numberfyedValue = +value;

        return !Number.isNaN(numberfyedValue);
      }

      return true;
    }
    return true;
  })
  .transform(Number);

@Injectable()
export class PaginationService {
  private resolveOptions(options: IPaginationOptions) {
    try {
      const page = paginationParamSchema.default(1).parse(options.page);
      const limit = paginationParamSchema.default(10).parse(options.limit);
      const countQueries =
        typeof options.countQueries !== 'undefined'
          ? options.countQueries
          : true;
      const cacheQueries = options.cacheQueries || false;

      return { page, limit, countQueries, cacheQueries };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestError();
      }

      throw new Error(error);
    }
  }

  public async paginate<T extends ObjectLiteral>(
    entityRepository: Repository<T>,
    options: IPaginationOptions,
    searchOptions?: FindOptionsWhere<T> | FindManyOptions<T>,
  ): Promise<Pagination<T>> {
    const { limit, page, countQueries } = this.resolveOptions(options);

    const promises: [Promise<T[]>, Promise<number> | undefined] = [
      entityRepository.find({
        skip: limit * (page - 1),
        take: limit,
        ...searchOptions,
      }),
      undefined,
    ];

    if (countQueries) {
      promises[1] = entityRepository.count({
        ...searchOptions,
      });
    }

    const [items, total] = await Promise.all(promises);
    const totalPages = Math.ceil(items.length / limit) || undefined;
    return {
      items,
      meta: {
        currentPage: page,
        itemCount: items.length,
        itemsPerPage: limit,
        totalItems: total,
        totalPages,
        hasNext: page < totalPages,
        //   items.length * totalPages < total ? totalPages + 1 : totalPages,
      },
    };
  }
  //   public async paginateWithQueryBuilder<T extends ObjectLiteral>(
  //     queryBuilder: SelectQueryBuilder<T>,
  //     options: PaginationArgs,
  //   ): Promise<Pagination<T>> {
  //     const { parsedLimit, parsedPage } = this.parseLimitAndPage(
  //       options.limit,
  //       options.page,
  //     );

  //     return paginate<T>(queryBuilder, {
  //       ...options,
  //       limit: parsedLimit,
  //       page: parsedPage,
  //     });
  //   }
}
