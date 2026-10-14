import { NextFunction, Request, Response } from "express";


export const errorMiddleware = (error: unknown, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof Error)
    return res.status(500).json({
        success: false,
        message: error?.message,
        data: {},
    });
};