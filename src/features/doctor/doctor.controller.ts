import { Request, Response } from 'express';
import {
  createDoctorSchema,
  doctorIdSchema,
  getDoctorsSchema,
  updateDoctorSchema,
} from '../../validators/doctor.validator';
import { validate } from '../../validators/validate';
import { DoctorService } from './doctor.service';

export class DoctorController {
  static async createDoctor(req: Request, res: Response) {
    const { body } = validate(createDoctorSchema, { body: req.body });

    const doctor = await DoctorService.create({ body });

    res.status(201).json({
      success: true,
      message: 'doctor created successfully',
      data: doctor,
    });
  }

  static async getDoctors(req: Request, res: Response) {
    const { query } = validate(getDoctorsSchema, { query: req.query });

    const { doctors, meta } = await DoctorService.getAll({ query });

    res.status(200).json({
      success: true,
      message: 'doctors retrieved successfully',
      data: doctors,
      meta,
    });
  }

  static async uploadPhoto(req: Request, res: Response) {
    const photo = await DoctorService.uploadPhoto(req.file);

    res.status(201).json({
      success: true,
      message: 'photo uploaded successfully',
      data: photo,
    });
  }

  static async getDoctorById(req: Request, res: Response) {
    const { params } = validate(doctorIdSchema, { params: req.params });

    const doctor = await DoctorService.getById({ params });

    res.status(200).json({
      success: true,
      message: 'doctor retrieved successfully',
      data: doctor,
    });
  }

  static async updateDoctor(req: Request, res: Response) {
    const { params, body } = validate(updateDoctorSchema, {
      params: req.params,
      body: req.body,
    });

    const doctor = await DoctorService.update({ params, body });

    res.status(200).json({
      success: true,
      message: 'doctor updated successfully',
      data: doctor,
    });
  }

  static async deleteDoctor(req: Request, res: Response) {
    const { params } = validate(doctorIdSchema, { params: req.params });

    await DoctorService.delete({ params });

    res.status(200).json({
      success: true,
      message: 'doctor deleted successfully',
      data: {},
    });
  }
}
