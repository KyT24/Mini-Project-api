import { prisma } from '../../configs/prisma-client.config';
import { AppError } from '../../errors/app.error';
import { Prisma } from '../../generated/prisma/client';
import { fromDbTime, toDbTime } from '../../lib/time.lib';
import { getSupabaseClient } from '../../lib/supabase.lib';
import {
  createScheduleRequest,
  getSchedulesRequest,
  scheduleIdRequest,
  updateScheduleRequest,
} from '../../validators/schedule.validator';

const scheduleOrder = [
  { day_of_week: 'asc' },
  { start_time: 'asc' },
] satisfies Prisma.doctor_schedulesOrderByWithRelationInput[];

export class ScheduleService {
  private static async findOrFail(id: string) {
    const schedule = await prisma.doctor_schedules.findUnique({ where: { id } });

    if (!schedule) throw new AppError(404, 'schedule not found');

    return schedule;
  }

  private static async assertDoctorExists(id: string) {
    const doctor = await prisma.doctors.findUnique({ where: { id } });
    if (!doctor) throw new AppError(404, 'doctor not found');
  }

  // Jam praktik di hari yang sama tidak boleh beririsan (jadwal nonaktif ikut dicek
  // agar tidak bentrok saat diaktifkan lagi)
  private static async assertNoOverlap(
    doctorId: string,
    day: number,
    start: string,
    end: string,
    exceptId?: string,
  ) {
    // Bentrok jika jadwal lain mulai sebelum jadwal ini selesai
    // dan selesai setelah jadwal ini mulai
    const where: Prisma.doctor_schedulesWhereInput = {
      doctor_id: doctorId,
      day_of_week: day,
      start_time: { lt: toDbTime(end) },
      end_time: { gt: toDbTime(start) },
    };

    // Saat update, jadwal yang sedang diubah tidak ikut dicek
    if (exceptId) {
      where.NOT = { id: exceptId };
    }

    const clash = await prisma.doctor_schedules.findFirst({ where });

    if (clash) {
      throw new AppError(
        409,
        `schedule overlaps with ${fromDbTime(clash.start_time)}-${fromDbTime(clash.end_time)}`,
      );
    }
  }

  static async getAll({ query }: getSchedulesRequest) {
    const { doctor_id, is_active } = query;

    try {
      const supabase = getSupabaseClient();
      let q = supabase.from('doctor_schedules').select('*');

      if (doctor_id) q = q.eq('doctor_id', doctor_id);
      if (is_active !== undefined) q = q.eq('is_active', is_active);

      q = q.order('day_of_week', { ascending: true }).order('start_time', { ascending: true });

      const { data, error } = await q;
      if (error) throw error;

      return (data || []).map((s: any) => ({
        id: s.id,
        doctor_id: s.doctor_id,
        day_of_week: Number(s.day_of_week),
        start_time: s.start_time,
        end_time: s.end_time,
        patient_quota: Number(s.patient_quota),
        is_active: Boolean(s.is_active),
        created_at: s.created_at,
        updated_at: s.updated_at,
      }));
    } catch {
      const where: Prisma.doctor_schedulesWhereInput = { doctor_id };
      if (is_active !== undefined) {
        where.is_active = is_active;
      }

      return await prisma.doctor_schedules.findMany({
        where,
        orderBy: scheduleOrder,
      });
    }
  }

  static async create({ body }: createScheduleRequest) {
    const { doctor_id, day_of_week, start_time, end_time, ...schedule } = body;

    await this.assertDoctorExists(doctor_id);
    await this.assertNoOverlap(doctor_id, day_of_week, start_time, end_time);

    return await prisma.doctor_schedules.create({
      data: {
        ...schedule,
        doctor_id,
        day_of_week,
        start_time: toDbTime(start_time),
        end_time: toDbTime(end_time),
      },
    });
  }

  // Sesi yang sudah terbentuk tidak ikut berubah, booking lama tetap berlaku
  static async update({ params, body }: updateScheduleRequest) {
    const current = await this.findOrFail(params.id);

    const day = body.day_of_week ?? current.day_of_week;
    const start = body.start_time ?? fromDbTime(current.start_time);
    const end = body.end_time ?? fromDbTime(current.end_time);
    if (end <= start) throw new AppError(422, 'End time must be after start time');

    await this.assertNoOverlap(current.doctor_id, day, start, end, current.id);

    const { start_time, end_time, ...schedule } = body;

    const data: Prisma.doctor_schedulesUpdateInput = { ...schedule };

    // Jam hanya diubah jika dikirim, lalu dikonversi ke format kolom DB
    if (start_time) {
      data.start_time = toDbTime(start_time);
    }
    if (end_time) {
      data.end_time = toDbTime(end_time);
    }

    return await prisma.doctor_schedules.update({
      where: { id: params.id },
      data,
    });
  }

  static async delete({ params }: scheduleIdRequest) {
    await this.findOrFail(params.id);

    return await prisma.doctor_schedules.delete({ where: { id: params.id } });
  }
}
