import { Router } from 'express';
import { AuthsController } from './auth.controller';
import { verifyRole, verifyToken } from '../../middlewares/auth.middleware';

export const AuthRouter=Router()

AuthRouter.post('/register', AuthsController.register)
AuthRouter.post(
  '/admins',
  verifyToken,
  verifyRole('ADMIN'),
  AuthsController.registerAdmin,
);
AuthRouter.post('/login', AuthsController.login);
AuthRouter.get('/me', verifyToken, AuthsController.me);
AuthRouter.post('/logout', AuthsController.logout);
