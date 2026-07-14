import { Router } from "express";
import * as authController from "./auth.controller";
import { requireAuth } from "./auth.middleware";

const router = Router();

router.post("/signup", authController.signupHandler);
router.post("/login", authController.loginHandler);
router.post("/google", authController.googleHandler);
router.post("/refresh", authController.refreshHandler);
router.get("/me", requireAuth, authController.meHandler);
router.post("/logout", authController.logoutHandler);

export default router;
