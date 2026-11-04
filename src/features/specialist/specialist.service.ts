import { prisma } from '../../configs/prisma-client.config';
import { AppError } from '../../errors/app.error';
import { Prisma } from '../../generated/prisma/client';
import { getSupabaseClient } from '../../lib/supabase.lib';
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
    if (existing && existing.id !== exceptId) {
      throw new AppError(409, 'specialist name already registered');
    }
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

    try {
      const supabase = getSupabaseClient();
      let q = supabase
        .from('specialists')
        .select('*, doctors:doctors(id)', { count: 'exact' });

      if (is_active !== undefined) {
        q = q.eq('is_active', is_active);
      }
      if (search) {
        q = q.ilike('name', `%${search}%`);
      }

      q = q.order('name', { ascending: true });

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      const { data, count, error } = await q.range(from, to);

      if (error) throw error;

      const specialists = (data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        is_active: s.is_active,
        created_at: s.created_at,
        updated_at: s.updated_at,
        _count: {
          doctors: Array.isArray(s.doctors) ? s.doctors.length : 0,
        },
      }));

      const total = count || specialists.length;
      return {
        specialists,
        meta: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 },
      };
    } catch {
      // Filter hanya ditambahkan jika diisi dari query
      const where: Prisma.specialistsWhereInput = {};
      if (is_active !== undefined) {
        where.is_active = is_active;
      }
      if (search) {
        where.name = { contains: search, mode: 'insensitive' };
      }

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

    if (specialist._count.doctors) {
      throw new AppError(
        409,
        'specialist is still used by doctors; deactivate instead',
      );
    }

    return await prisma.specialists.delete({ where: { id: params.id } });
  }
}
