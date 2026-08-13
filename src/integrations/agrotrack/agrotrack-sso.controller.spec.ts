import { NotFoundException } from '@nestjs/common';
import { AgroTrackSsoController } from './agrotrack-sso.controller';

describe('AgroTrackSsoController', () => {
  const currentUser = { id: 'farmer-1' } as any;

  it('returns the handoff token on success', async () => {
    const agroTrackIntegration = {
      issueSsoHandoffToken: jest.fn().mockResolvedValue({
        token: 'abc123',
        expiresAt: '2026-08-14T09:14:00Z',
      }),
    };
    const controller = new AgroTrackSsoController(agroTrackIntegration as any);

    const result = await controller.getHandoffToken(currentUser);

    expect(agroTrackIntegration.issueSsoHandoffToken).toHaveBeenCalledWith(
      'farmer-1',
    );
    expect(result.data).toEqual({
      token: 'abc123',
      expiresAt: '2026-08-14T09:14:00Z',
    });
  });

  it('throws NotFoundException when there is no linked AgroTrack account', async () => {
    const agroTrackIntegration = {
      issueSsoHandoffToken: jest.fn().mockResolvedValue(null),
    };
    const controller = new AgroTrackSsoController(agroTrackIntegration as any);

    await expect(controller.getHandoffToken(currentUser)).rejects.toThrow(
      NotFoundException,
    );
  });
});
