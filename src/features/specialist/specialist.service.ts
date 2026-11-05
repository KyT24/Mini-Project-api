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
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('specialists')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) return data;
    } catch {
      // Prisma fallback
    }

    try {
      const specialist = await prisma.specialists.findUnique({
        where: { id },
        include: specialistInclude,
      });

      if (specialist) return specialist;
    } catch {
      // Ignore Prisma error
    }

    throw new AppError(404, 'specialist not found');
  }

  private static async assertNameAvailable(name: string, exceptId?: string) {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('specialists')
        .select('id')
        .eq('name', name)
        .maybeSingle();

      if (!error && data && data.id !== exceptId) {
        throw new AppError(409, 'specialist name already registered');
      }
      if (!error && (!data || data.id === exceptId)) return;
    } catch (e) {
      if (e instanceof AppError) throw e;
    }

    try {
      const existing = await prisma.specialists.findUnique({ where: { name } });
      if (existing && existing.id !== exceptId) {
        throw new AppError(409, 'specialist name already registered');
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
    }
  }

  static async create({ body }: createSpecialistRequest) {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('specialists')
        .insert({
          name: body.name,
          description: body.description,
          is_active: body.is_active ?? true,
        })
        .select('*, doctors:doctors(id)')
        .single();

      if (!error && data) {
        return {
          id: data.id,
          name: data.name,
          description: data.description,
          is_active: data.is_active,
          created_at: data.created_at,
          updated_at: data.updated_at,
          _count: { doctors: Array.isArray(data.doctors) ? data.doctors.length : 0 },
        };
      }
    } catch {
      // Prisma fallback
    }

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
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('specialists')
        .select('*, doctors:doctors(id)')
        .eq('id', params.id)
        .single();

      if (!error && data) {
        return {
          id: data.id,
          name: data.name,
          description: data.description,
          is_active: data.is_active,
          created_at: data.created_at,
          updated_at: data.updated_at,
          _count: { doctors: Array.isArray(data.doctors) ? data.doctors.length : 0 },
        };
      }
    } catch {
      // Prisma fallback
    }

    return await this.findOrFail(params.id);
  }

  static async update({ params, body }: updateSpecialistRequest) {
    try {
      const supabase = getSupabaseClient();
      const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;

      const { data, error } = await supabase
        .from('specialists')
        .update(updateData)
        .eq('id', params.id)
        .select('*, doctors:doctors(id)')
        .single();

      if (!error && data) {
        return {
          id: data.id,
          name: data.name,
          description: data.description,
          is_active: data.is_active,
          created_at: data.created_at,
          updated_at: data.updated_at,
          _count: { doctors: Array.isArray(data.doctors) ? data.doctors.length : 0 },
        };
      }
    } catch {
      // Prisma fallback
    }

    await this.findOrFail(params.id);
    if (body.name) await this.assertNameAvailable(body.name, params.id);

    return await prisma.specialists.update({
      where: { id: params.id },
      data: body,
      include: specialistInclude,
    });
  }

  static async delete({ params }: specialistIdRequest) {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('specialists')
        .delete()
        .eq('id', params.id)
        .select()
        .single();

      if (!error && data) {
        return data;
      }
    } catch {
      // Prisma fallback
    }

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
