import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import {
  ShareLinkError,
  createShareLinkForDevice,
  createShareLinkForSite,
  listShareLinks,
  resolveShareToken,
  revokeShareLinkForUser,
} from '../services/shareLinksService';

const scopeParamsSchema = z.object({ id: z.string().uuid() });
const revokeParamsSchema = z.object({ id: z.string().uuid() });
const publicParamsSchema = z.object({ token: z.string().min(10) });
const shareLinkBodySchema = z.object({
  expiresAt: z.union([z.string().datetime(), z.string().min(1), z.date()]),
  permissions: z.string().optional(),
});

function handleShareLinkError(err: unknown, res: Response, next: NextFunction) {
  if (err instanceof ShareLinkError) {
    switch (err.reason) {
      case 'INVALID_EXPIRY':
        return res.status(400).json({ message: err.message });
      case 'FORBIDDEN':
        return res.status(403).json({ message: err.message });
      case 'NOT_FOUND':
        return res.status(404).json({ message: err.message });
      case 'UNAUTHORIZED':
        return res.status(401).json({ message: err.message });
      default:
        return res.status(400).json({ message: err.message });
    }
  }
  return next(err);
}

export async function createSiteShareLink(req: Request, res: Response, next: NextFunction) {
  const parsedParams = scopeParamsSchema.safeParse(req.params);
  const parsedBody = shareLinkBodySchema.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success) {
    return res.status(400).json({ message: 'Invalid request' });
  }

  try {
    const link = await createShareLinkForSite(
      req.user!.id,
      parsedParams.data.id,
      parsedBody.data.expiresAt,
      parsedBody.data.permissions ?? 'read_only'
    );
    return res.status(201).json(link);
  } catch (err) {
    return handleShareLinkError(err, res, next);
  }
}

export async function createDeviceShareLink(req: Request, res: Response, next: NextFunction) {
  const parsedParams = scopeParamsSchema.safeParse(req.params);
  const parsedBody = shareLinkBodySchema.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success) {
    return res.status(400).json({ message: 'Invalid request' });
  }

  try {
    const link = await createShareLinkForDevice(
      req.user!.id,
      parsedParams.data.id,
      parsedBody.data.expiresAt,
      parsedBody.data.permissions ?? 'read_only'
    );
    return res.status(201).json(link);
  } catch (err) {
    return handleShareLinkError(err, res, next);
  }
}

export async function listSiteShareLinks(req: Request, res: Response, next: NextFunction) {
  const parsedParams = scopeParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid site id' });
  }

  try {
    const links = await listShareLinks(req.user!.id, 'site', parsedParams.data.id);
    return res.json(links);
  } catch (err) {
    return handleShareLinkError(err, res, next);
  }
}

export async function listDeviceShareLinks(req: Request, res: Response, next: NextFunction) {
  const parsedParams = scopeParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid device id' });
  }

  try {
    const links = await listShareLinks(req.user!.id, 'device', parsedParams.data.id);
    return res.json(links);
  } catch (err) {
    return handleShareLinkError(err, res, next);
  }
}

export async function revokeShareLinkHandler(req: Request, res: Response, next: NextFunction) {
  const parsedParams = revokeParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid share link id' });
  }

  try {
    await revokeShareLinkForUser(req.user!.id, parsedParams.data.id);
    return res.status(204).send();
  } catch (err) {
    return handleShareLinkError(err, res, next);
  }
}

export async function resolvePublicShare(req: Request, res: Response, next: NextFunction) {
  const parsedParams = publicParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(404).json({ message: 'Share link not found' });
  }

  try {
    const payload = await resolveShareToken(parsedParams.data.token);
    return res.json(payload);
  } catch (err) {
    if (err instanceof ShareLinkError && err.reason === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Share link not found' });
    }
    return handleShareLinkError(err, res, next);
  }
}
