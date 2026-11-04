import { Request, Response } from 'express';
import { updatePatientMeSchema } from '../../validators/patient.validator';
import { validate } from '../../validators/validate';
import { PatientService } from './patient.service';

export class PatientController {
  static async getMe(req: Request, res: Response) {
    const auth = res.locals.auth;
    const patient = await PatientService.getMe(auth.id, auth.email);

    res.status(200).json({
      success: true,
      message: 'patient profile retrieved successfully',
      data: patient,
    });
  }

  static async updateMe(req: Request, res: Response) {
    const { body } = validate(updatePatientMeSchema, { body: req.body });

    const patient = await PatientService.updateMe(res.locals.auth.id, {
      body,
    });

    res.status(200).json({
      success: true,
      message: 'patient profile updated successfully',
      data: patient,
    });
  }
}
