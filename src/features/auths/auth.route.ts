import { Router } from 'express';
import { AuthsController } from './auth.controller';

export const AuthRouter=Router()

AuthRouter.post('/register', AuthsController.register)
AuthRouter.post('/login', AuthsController.login);
