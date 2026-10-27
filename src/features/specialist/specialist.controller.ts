import { Request, Response } from 'express';
import {
  createSpecialistSchema,
  getSpecialistsSchema,
  specialistIdSchema,
  updateSpecialistSchema,
} from '../../validators/specialist.validator';
import { validate } from '../../validators/validate';
import { SpecialistService } from './specialist.service';

export class SpecialistController {
  static async createSpecialist(req: Request, res: Response) {
    const { body } = validate(createSpecialistSchema, { body: req.body });

    const specialist = await SpecialistService.create({ body });

    res.status(201).json({
      success: true,
      message: 'specialist created successfully',
      data: specialist,
    });
  }

  static async getSpecialists(req: Request, res: Response) {
    const { query } = validate(getSpecialistsSchema, { query: req.query });

    const { specialists, meta } = await SpecialistService.getAll({ query });

    res.status(200).json({
      success: true,
      message: 'specialists retrieved successfully',
      data: specialists,
      meta,
    });
  }

  static async getSpecialistById(req: Request, res: Response) {
    const { params } = validate(specialistIdSchema, { params: req.params });

    const specialist = await SpecialistService.getById({ params });

    res.status(200).json({
      success: true,
      message: 'specialist retrieved successfully',
      data: specialist,
    });
  }

  static async updateSpecialist(req: Request, res: Response) {
    const { params, body } = validate(updateSpecialistSchema, {
      params: req.params,
      body: req.body,
    });

    const specialist = await SpecialistService.update({ params, body });

    res.status(200).json({
      success: true,
      message: 'specialist updated successfully',
      data: specialist,
    });
  }

  static async deleteSpecialist(req: Request, res: Response) {
    const { params } = validate(specialistIdSchema, { params: req.params });

    await SpecialistService.delete({ params });

    res.status(200).json({
      success: true,
      message: 'specialist deleted successfully',
      data: {},
    });
  }
}
