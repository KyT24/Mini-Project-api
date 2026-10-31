import { prisma } from '../../configs/prisma-client.config';
import { AppError } from "../../errors/app.error";

// "today" must use the clinic timezone, or the date is wrong for some hours each day
function todayInJakarta() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

export class QueueService {
  // On-site check-in, check-in window and queue number
  static async checkIn(qrToken: string, staffUserId: string) {
    const appointment = await prisma.appointments.findUnique({
      where: { qr_token: qrToken },
      include: { practice_sessions: true, check_ins: true },
    });

    if (!appointment) {
      throw new AppError(404, "QR code is not valid");
    }

    if (appointment.status !== "done") {
      throw new AppError(400, "This appointment is not accepted yet");
    }

    if (appointment.practice_sessions.status === "canceled") {
      throw new AppError(400, "This practice session was canceled");
    }

    // check-in window: only on the session date
    const sessionDate = appointment.practice_sessions.session_date
      .toISOString()
      .slice(0, 10);

    if (sessionDate !== todayInJakarta()) {
      throw new AppError(400, "Check-in is only allowed on the session date");
    }

    if (appointment.check_ins) {
      if (appointment.check_ins.status === "no_show") {
        throw new AppError(400, "This appointment was marked as no-show");
      }
      throw new AppError(400, "This patient is already checked in");
    }

    // everything inside runs as one unit: if one step fails, all steps are undone
    const queueNumber = await prisma.$transaction(async (tx) => {
      // only changes the row if checked_in_at is still empty,
      // so a double scan at the same moment cannot check in twice
      const changed = await tx.appointments.updateMany({
        where: { id: appointment.id, checked_in_at: null },
        data: { checked_in_at: new Date() },
      });

      if (changed.count === 0) {
        throw new AppError(400, "This patient is already checked in");
      }

      // the database adds 1 safely, so two patients never get the same number
      const queue = await tx.session_queues.upsert({
        where: { session_id: appointment.session_id },
        update: { last_queue_number: { increment: 1 } },
        create: { session_id: appointment.session_id, last_queue_number: 1 },
      });

      await tx.appointments.update({
        where: { id: appointment.id },
        data: { queue_number: queue.last_queue_number },
      });

      await tx.check_ins.create({
        data: {
          appointment_id: appointment.id,
          checked_in_by: staffUserId,
        },
      });

      return queue.last_queue_number;
    });

    return {
      appointment_code: appointment.appointment_code,
      queue_number: queueNumber,
    };
  }

  // Call next patient: only checked-in patients can be called
  static async callNext(sessionId: string) {
    const queue = await prisma.session_queues.findUnique({
      where: { session_id: sessionId },
    });

    if (!queue) {
      throw new AppError(404, "Session queue not found");
    }

    const next = await prisma.appointments.findFirst({
      where: {
        session_id: sessionId,
        queue_number: { gt: queue.current_number },
        check_ins: { status: "checked_in" },
      },
      orderBy: { queue_number: "asc" },
    });

    if (!next || next.queue_number === null) {
      throw new AppError(400, "No checked-in patient is waiting");
    }

    await prisma.session_queues.update({
      where: { session_id: sessionId },
      data: { current_number: next.queue_number },
    });

    return { current_number: next.queue_number };
  }

  // No-show: admin marks a patient who did not come
  static async markNoShow(appointmentId: string, staffUserId: string) {
    const appointment = await prisma.appointments.findUnique({
      where: { id: appointmentId },
      include: { check_ins: true },
    });

    if (!appointment) {
      throw new AppError(404, "Appointment not found");
    }

    if (appointment.status !== "done") {
      throw new AppError(400, "Only accepted appointments can be marked as no-show");
    }

    if (appointment.check_ins) {
      if (appointment.check_ins.status === "no_show") {
        throw new AppError(400, "This appointment is already marked as no-show");
      }

      // the patient checked in but did not answer when called
      await prisma.check_ins.update({
        where: { appointment_id: appointmentId },
        data: { status: "no_show" },
      });
      return;
    }

    // the patient never checked in
    await prisma.check_ins.create({
      data: {
        appointment_id: appointmentId,
        checked_in_by: staffUserId,
        status: "no_show",
      },
    });
  }

  // Live queue: public, so it returns numbers only, never patient names
  static async liveQueue() {
    const sessions = await prisma.practice_sessions.findMany({
      where: {
        session_date: new Date(todayInJakarta()),
        status: { in: ["scheduled", "ongoing"] },
      },
      include: { doctors: true, session_queues: true },
    });

    const result = [];

    for (const session of sessions) {
      let currentNumber = 0;
      if (session.session_queues) {
        currentNumber = session.session_queues.current_number;
      }

      const waiting = await prisma.appointments.findMany({
        where: {
          session_id: session.id,
          queue_number: { gt: currentNumber },
          check_ins: { status: "checked_in" },
        },
        orderBy: { queue_number: "asc" },
        take: 3,
      });

      const nextUp = [];
      for (const item of waiting) {
        nextUp.push(item.queue_number);
      }

      result.push({
        session_id: session.id,
        doctor_name: session.doctors.full_name,
        current_number: currentNumber,
        next_up: nextUp,
      });
    }

    return result;
  }
}