import { prisma } from '../../configs/prisma-client.config';
import { AppError } from '../../errors/app.error';
import { Prisma } from '../../generated/prisma/client';
import {
  createSpecialistRequest,
  getSpecialistsRequest,
  specialistIdRequest,
  updateSpecialistRequest,
} from '../../validators/specialist.validator';

const specialistInclude = {
  _count: { select: { doctors: true } },
} satisfies Prisma.specialistsInclude;

export class SpecialistService {
  private static async findOrFail(id: string) {
    const specialist = await prisma.specialists.findUnique({
      where: { id },
      include: specialistInclude,
    });

    if (!specialist) throw new AppError(404, 'specialist not found');

    return specialist;
  }

  private static async assertNameAvailable(name: string, exceptId?: string) {
    const existing = await prisma.specialists.findUnique({ where: { name } });
    if (existing && existing.id !== exceptId)
      throw new AppError(409, 'specialist name already registered');
  }

  static async create({ body }: createSpecialistRequest) {
    await this.assertNameAvailable(body.name);

    return await prisma.specialists.create({
      data: body,
      include: specialistInclude,
    });
  }

  static async getAll({ query }: getSpecialistsRequest) {
    const { page, limit, search, is_active } = query;

    const where: Prisma.specialistsWhereInput = {
      ...(is_active !== undefined && { is_active }),
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    };

    const [specialists, total] = await Promise.all([
      prisma.specialists.findMany({
        where,
        include: specialistInclude,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.specialists.count({ where }),
    ]);

    return {
      specialists,
      meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  static async getById({ params }: specialistIdRequest) {
    return await this.findOrFail(params.id);
  }

  static async update({ params, body }: updateSpecialistRequest) {
    await this.findOrFail(params.id);
    if (body.name) await this.assertNameAvailable(body.name, params.id);

    return await prisma.specialists.update({
      where: { id: params.id },
      data: body,
      include: specialistInclude,
    });
  }

  static async delete({ params }: specialistIdRequest) {
    const specialist = await this.findOrFail(params.id);

    if (specialist._count.doctors)
      throw new AppError(
        409,
        'specialist is still used by doctors; deactivate instead',
      );

    return await prisma.specialists.delete({ where: { id: params.id } });
  }
}
