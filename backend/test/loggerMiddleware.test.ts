import { EventEmitter } from 'events';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loggerMocks = vi.hoisted(() => {
  const infoSpy = vi.fn();
  const warnSpy = vi.fn();
  const errorSpy = vi.fn();
  const childSpy = vi.fn();
  const logger = { info: infoSpy, warn: warnSpy, error: errorSpy, child: childSpy };
  childSpy.mockImplementation(() => logger);
  return { infoSpy, warnSpy, errorSpy, childSpy, logger };
});

vi.mock('../src/config/logger', () => ({
  logger: loggerMocks.logger,
}));

// eslint-disable-next-line import/first
import { requestLogger } from '../src/middleware/logger';

const { infoSpy, warnSpy, errorSpy, childSpy } = loggerMocks;

type MockResponse = Response & EventEmitter & { setHeader: ReturnType<typeof vi.fn>; statusCode: number };

function createResponse(statusCode = 200): MockResponse {
  const res = new EventEmitter() as MockResponse;
  res.setHeader = vi.fn();
  res.statusCode = statusCode;
  return res;
}

describe('requestLogger middleware', () => {
  beforeEach(() => {
    infoSpy.mockClear();
    warnSpy.mockClear();
    errorSpy.mockClear();
    childSpy.mockClear();
  });

  it('assigns a request id, echoes it in headers, and logs start/end', () => {
    const req = {
      headers: {},
      method: 'GET',
      originalUrl: '/test',
    } as Request;
    const res = createResponse(204);
    const next = vi.fn();

    requestLogger(req, res, next);

    expect(req.requestId).toBeDefined();
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.requestId);
    expect(next).toHaveBeenCalled();
    expect(childSpy).toHaveBeenCalledWith({ module: 'http', requestId: req.requestId });

    res.emit('finish');

    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: '/test' }),
      'request.start'
    );
    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/test',
        status: 204,
        durationMs: expect.any(Number),
      }),
      'request.complete'
    );
  });

  it('reuses a provided request id header and logs failures', () => {
    const reqId = 'external-req-id';
    const req = {
      headers: { 'x-request-id': reqId },
      method: 'POST',
      originalUrl: '/fail',
    } as Request;
    const res = createResponse(500);
    const next = vi.fn();

    requestLogger(req, res, next);
    res.emit('error', new Error('boom'));

    expect(req.requestId).toBe(reqId);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', reqId);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        path: '/fail',
        status: 500,
        durationMs: expect.any(Number),
      }),
      'request.fail'
    );
  });
});
