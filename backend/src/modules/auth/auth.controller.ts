import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { parseBody } from "../../shared/utils";
import * as authService from "./auth.service";

const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

const googleSchema = z.object({
  idToken: z.string().min(1, "idToken is required"),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
});

const crmWebhookSchema = z.object({
  webhookUrl: z.string().url("Must be a valid URL").nullable(),
});

export async function signupHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, password } = parseBody(signupSchema, req.body);
    const result = await authService.signup(name, email, password);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = parseBody(loginSchema, req.body);
    const result = await authService.login(email, password);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function googleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { idToken } = parseBody(googleSchema, req.body);
    const result = await authService.loginWithGoogle(idToken);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function refreshHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = parseBody(refreshSchema, req.body);
    const result = await authService.refreshAccessToken(refreshToken);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function meHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.getMe(req.user!.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateCrmWebhookHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { webhookUrl } = parseBody(crmWebhookSchema, req.body);
    const result = await authService.updateCrmWebhookUrl(req.user!.id, webhookUrl);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function logoutHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = parseBody(refreshSchema, req.body);
    const result = await authService.logout(refreshToken);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
