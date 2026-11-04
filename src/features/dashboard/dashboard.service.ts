import { prisma } from '../../configs/prisma-client.config';
import { Prisma } from '../../generated/prisma/client';
import { toDbDate } from '../../lib/time.lib';
import { getSupabaseClient } from '../../lib/supabase.lib';
import { clinicNow } from '../appointment/appointment.helpers';
import { getDashboardStatsRequest } from '../../validators/dashboard.validator';

export class DashboardService {
  // Ringkasan metrik dashboard admin
  static async getMetrics() {
    const todayWib = clinicNow().date;

    try {
      const supabase = getSupabaseClient();

      // 1. Sesi aktif hari ini
      const { data: sessions, error: sessErr } = await supabase
        .from('practice_sessions')
        .select('id, session_date, current_queue_number')
        .eq('session_date', todayWib);

      if (sessErr) throw sessErr;

      const sessionList = sessions || [];
      const sessionIds = sessionList.map((s: any) => s.id);

      let todayAppointments = 0;
      let waitingQueue = 0;
      let todayRevenue = 0;

      if (sessionIds.length > 0) {
        const { data: appts, error: apptErr } = await supabase
          .from('appointments')
          .select('id, session_id, status, queue_number, checked_in_at, is_no_show, consultation_fee')
          .in('session_id', sessionIds);

        if (!apptErr && appts) {
          todayAppointments = appts.filter(
            (a: any) => a.status !== 'canceled' && a.status !== 'expired',
          ).length;

          for (const session of sessionList) {
            const current = session.current_queue_number ?? 0;
            const waitingInSession = appts.filter(
              (a: any) =>
                a.session_id === session.id &&
                a.status === 'done' &&
                a.checked_in_at &&
                !a.is_no_show &&
                (a.queue_number ?? 0) > current,
            );
            waitingQueue += waitingInSession.length;
          }

          todayRevenue = appts
            .filter((a: any) => a.status === 'done')
            .reduce((sum: number, a: any) => sum + Number(a.consultation_fee || 0), 0);
        }
      }

      const { count: pendingCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'waiting_confirmation');

      return {
        today_appointments: todayAppointments,
        waiting_queue: waitingQueue,
        pending_verification: pendingCount || 0,
        today_revenue: todayRevenue,
      };
    } catch {
      // Prisma fallback bila Supabase tidak tersedia
    }

    const todayDate = toDbDate(todayWib);

    const [todayAppointments, pendingVerification, todayDoneAppointments, activeSessions] =
      await Promise.all([
        prisma.appointments.count({
          where: {
            practice_sessions: { session_date: todayDate },
            status: { notIn: ['canceled', 'expired'] },
          },
        }),
        prisma.appointments.count({
          where: { status: 'waiting_confirmation' },
        }),
        prisma.appointments.findMany({
          where: {
            practice_sessions: { session_date: todayDate },
            status: 'done',
          },
          select: { consultation_fee: true },
        }),
        prisma.practice_sessions.findMany({
          where: { session_date: todayDate },
          include: {
            appointments: {
              where: {
                status: 'done',
                checked_in_at: { not: null },
                is_no_show: false,
              },
              select: { queue_number: true },
            },
          },
        }),
      ]);

    let waitingQueue = 0;
    for (const session of activeSessions) {
      const current = session.current_queue_number ?? 0;
      waitingQueue += session.appointments.filter(
        (a) => (a.queue_number ?? 0) > current,
      ).length;
    }

    const todayRevenue = todayDoneAppointments.reduce(
      (sum, a) => sum + Number(a.consultation_fee || 0),
      0,
    );

    return {
      today_appointments: todayAppointments,
      waiting_queue: waitingQueue,
      pending_verification: pendingVerification,
      today_revenue: todayRevenue,
    };
  }

  // Laporan statistik grafik (Recharts) per hari / bulan / tahun
  static async getStats({ query }: getDashboardStatsRequest) {
    const { period, from, to, doctor_id } = query;

    try {
      const supabase = getSupabaseClient();
      let q = supabase
        .from('appointments')
        .select('id, status, consultation_fee, created_at, doctor_id, doctors(id, full_name)')
        .order('created_at', { ascending: true });

      if (doctor_id) q = q.eq('doctor_id', doctor_id);
      if (from) q = q.gte('created_at', `${from}T00:00:00.000Z`);
      if (to) q = q.lte('created_at', `${to}T23:59:59.999Z`);

      const { data: appointments, error } = await q;
      if (error) throw error;

      const appts = appointments || [];

      const timeMap = new Map<
        string,
        { label: string; done: number; rejected: number; canceled: number; expired: number; revenue: number }
      >();

      for (const appt of appts) {
        const date = new Date(appt.created_at);
        let key = '';

        if (period === 'day') {
          key = date.toISOString().slice(0, 10);
        } else if (period === 'month') {
          key = date.toISOString().slice(0, 7);
        } else {
          key = date.toISOString().slice(0, 4);
        }

        if (!timeMap.has(key)) {
          timeMap.set(key, { label: key, done: 0, rejected: 0, canceled: 0, expired: 0, revenue: 0 });
        }

        const item = timeMap.get(key)!;
        if (appt.status === 'done') {
          item.done += 1;
          item.revenue += Number(appt.consultation_fee || 0);
        } else if (appt.status === 'rejected') {
          item.rejected += 1;
        } else if (appt.status === 'canceled') {
          item.canceled += 1;
        } else if (appt.status === 'expired') {
          item.expired += 1;
        }
      }

      const doctorMap = new Map<
        string,
        { doctor_id: string; full_name: string; total_patients: number; total_revenue: number }
      >();

      for (const appt of appts) {
        if (appt.status !== 'done') continue;
        const dId = appt.doctor_id;
        const dName = (appt.doctors as any)?.full_name || 'Dokter';

        if (!doctorMap.has(dId)) {
          doctorMap.set(dId, { doctor_id: dId, full_name: dName, total_patients: 0, total_revenue: 0 });
        }

        const dItem = doctorMap.get(dId)!;
        dItem.total_patients += 1;
        dItem.total_revenue += Number(appt.consultation_fee || 0);
      }

      return {
        period,
        timeline: Array.from(timeMap.values()),
        doctor_performance: Array.from(doctorMap.values()),
        total_summary: {
          total_appointments: appts.length,
          total_done: appts.filter((a: any) => a.status === 'done').length,
          total_revenue: appts
            .filter((a: any) => a.status === 'done')
            .reduce((sum: number, a: any) => sum + Number(a.consultation_fee || 0), 0),
        },
      };
    } catch {
      // Prisma fallback
    }

    const where: Prisma.appointmentsWhereInput = {};

    if (doctor_id) {
      where.doctor_id = doctor_id;
    }

    if (from || to) {
      where.created_at = {};
      if (from) where.created_at.gte = new Date(`${from}T00:00:00.000Z`);
      if (to) where.created_at.lte = new Date(`${to}T23:59:59.999Z`);
    }

    const appointments = await prisma.appointments.findMany({
      where,
      select: {
        id: true,
        status: true,
        consultation_fee: true,
        created_at: true,
        doctor_id: true,
        doctors: { select: { id: true, full_name: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    // Agregasi berdasarkan periode
    const timeMap = new Map<
      string,
      { label: string; done: number; rejected: number; canceled: number; expired: number; revenue: number }
    >();

    for (const appt of appointments) {
      const date = appt.created_at;
      let key = '';

      if (period === 'day') {
        key = date.toISOString().slice(0, 10); // YYYY-MM-DD
      } else if (period === 'month') {
        key = date.toISOString().slice(0, 7); // YYYY-MM
      } else {
        key = date.toISOString().slice(0, 4); // YYYY
      }

      if (!timeMap.has(key)) {
        timeMap.set(key, { label: key, done: 0, rejected: 0, canceled: 0, expired: 0, revenue: 0 });
      }

      const item = timeMap.get(key)!;
      if (appt.status === 'done') {
        item.done += 1;
        item.revenue += Number(appt.consultation_fee || 0);
      } else if (appt.status === 'rejected') {
        item.rejected += 1;
      } else if (appt.status === 'canceled') {
        item.canceled += 1;
      } else if (appt.status === 'expired') {
        item.expired += 1;
      }
    }

    // Agregasi performa per dokter
    const doctorMap = new Map<
      string,
      { doctor_id: string; full_name: string; total_patients: number; total_revenue: number }
    >();

    for (const appt of appointments) {
      if (appt.status !== 'done') continue;
      const dId = appt.doctor_id;
      const dName = appt.doctors?.full_name || 'Dokter';

      if (!doctorMap.has(dId)) {
        doctorMap.set(dId, { doctor_id: dId, full_name: dName, total_patients: 0, total_revenue: 0 });
      }

      const dItem = doctorMap.get(dId)!;
      dItem.total_patients += 1;
      dItem.total_revenue += Number(appt.consultation_fee || 0);
    }

    return {
      period,
      timeline: Array.from(timeMap.values()),
      doctor_performance: Array.from(doctorMap.values()),
      total_summary: {
        total_appointments: appointments.length,
        total_done: appointments.filter((a) => a.status === 'done').length,
        total_revenue: appointments
          .filter((a) => a.status === 'done')
          .reduce((sum, a) => sum + Number(a.consultation_fee || 0), 0),
      },
    };
  }
}

