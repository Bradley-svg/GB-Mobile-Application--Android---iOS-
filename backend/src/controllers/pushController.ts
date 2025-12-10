import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import {
  isPushFeatureDisabled,
  registerPushToken,
  sendTestNotification,
} from '../modules/push/pushService';
import { getActiveTokensForUser } from '../modules/push/pushTokensRepository';
import { getUserContext, requireOrganisationId } from '../services/userService';

const registerSchema = z
  .object({
    expoPushToken: z.string().min(1).optional(),
    token: z.string().min(1).optional(),
    platform: z.enum(['android', 'ios', 'unknown']).default('unknown'),
  })
  .refine((data) => Boolean(data.expoPushToken || data.token), {
    message: 'Invalid body',
  });

export async function registerPushTokenHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const userId = req.user!.id;
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid body' });
  }

  try {
    const user = await getUserContext(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const orgId = requireOrganisationId(user);

    await registerPushToken({
      userId,
      orgId,
      token: parsed.data.expoPushToken ?? parsed.data.token!,
      platform: parsed.data.platform,
    });

    res.json({ ok: true });
  } catch (e) {
    if ((e as Error | undefined)?.message === 'INVALID_PUSH_TOKEN') {
      return res.status(400).json({ message: 'Invalid Expo push token' });
    }
    next(e);
  }
}

export async function sendTestPushNotification(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const userId = req.user!.id;

  try {
    const user = await getUserContext(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const orgId = requireOrganisationId(user);

    if (isPushFeatureDisabled()) {
      return res
        .status(503)
        .json({ code: 'PUSH_DISABLED', message: 'Push notifications are disabled' });
    }

    const tokens = await getActiveTokensForUser(userId);
    if (!tokens.length) {
      return res.status(404).json({
        code: 'NO_PUSH_TOKENS_REGISTERED',
        message: 'No active push tokens registered for this user',
      });
    }

    const result = await sendTestNotification({ orgId, userId, tokens });
    if (result.skippedReason === 'not_configured') {
      return res
        .status(503)
        .json({ code: 'PUSH_NOT_CONFIGURED', message: 'Push is not configured for this env' });
    }

    if (result.errors?.length) {
      return res.status(502).json({
        code: 'PUSH_SEND_FAILED',
        message: 'Failed to send test push notification',
        errors: result.errors,
      });
    }

    res.json({
      ok: true,
      attempted: result.attempted,
      sent: result.sent,
    });
  } catch (e) {
    next(e);
  }
}
