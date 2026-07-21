import { describe, it, expect, vi } from 'vitest';
import { eligibilityMiddleware } from './eligibility.js';
import { Response } from 'express';

describe('Eligibility Middleware Tests', () => {
  it('rejects if req.user is missing', () => {
    const req = {} as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    eligibilityMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects if req.user is not age attested', () => {
    const req = {
      user: {
        userId: 'some-user-id',
        ageAttested: false,
      },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    eligibilityMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next if user is age attested', () => {
    const req = {
      user: {
        userId: 'some-user-id',
        ageAttested: true,
      },
    } as any;
    const res = {} as Response;
    const next = vi.fn();

    eligibilityMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
