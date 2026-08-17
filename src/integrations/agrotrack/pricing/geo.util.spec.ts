import {
  geocode,
  roadDistanceKm,
  haversineKm,
  resolveDistance,
  UnresolvableAddressError,
} from './geo.util';

describe('geo.util', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockFetchSequence = (...responses: unknown[]) => {
    const fn = jest.fn();
    for (const body of responses) {
      fn.mockImplementationOnce(async () => ({
        ok: true,
        status: 200,
        json: async () => body,
      }));
    }
    global.fetch = fn as any;
    return fn;
  };

  describe('geocode', () => {
    it('appends ", Nigeria" when the address does not already reference it', async () => {
      const fetchMock = mockFetchSequence([{ lat: '6.5244', lon: '3.3792' }]);

      const result = await geocode('Ikeja, Lagos');

      expect(result).toEqual([6.5244, 3.3792]);
      const calledUrl = (fetchMock.mock.calls[0][0] as string) ?? '';
      const q = new URL(calledUrl).searchParams.get('q');
      expect(q).toBe('Ikeja, Lagos, Nigeria');
    });

    it('does not double-append Nigeria if already present', async () => {
      const fetchMock = mockFetchSequence([{ lat: '6.5', lon: '3.3' }]);

      await geocode('Ikeja, Lagos, Nigeria');

      const calledUrl = (fetchMock.mock.calls[0][0] as string) ?? '';
      const q = new URL(calledUrl).searchParams.get('q') ?? '';
      expect(q.match(/Nigeria/g)?.length).toBe(1);
    });

    it('returns null when Nominatim finds nothing', async () => {
      mockFetchSequence([]);
      expect(await geocode('Nowhere Really')).toBeNull();
    });

    it('returns null on a network error rather than throwing', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
      expect(await geocode('Ikeja, Lagos')).toBeNull();
    });
  });

  describe('roadDistanceKm', () => {
    it('converts OSRM distance from metres to km', async () => {
      mockFetchSequence({ code: 'Ok', routes: [{ distance: 45000 }] });

      const km = await roadDistanceKm([6.5, 3.3], [9.0, 7.4]);

      expect(km).toBe(45);
    });

    it('returns null when OSRM reports a non-Ok code', async () => {
      mockFetchSequence({ code: 'NoRoute' });
      expect(await roadDistanceKm([6.5, 3.3], [9.0, 7.4])).toBeNull();
    });

    it('returns null when OSRM is unreachable', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('timeout'));
      expect(await roadDistanceKm([6.5, 3.3], [9.0, 7.4])).toBeNull();
    });
  });

  describe('haversineKm', () => {
    it('computes the road-corrected straight-line distance between two points', () => {
      // Lagos (6.5244, 3.3792) to Kano (12.0022, 8.5920) — ~835km straight-line,
      // road-corrected (x1.3) to ~1086km.
      const km = haversineKm([6.5244, 3.3792], [12.0022, 8.592]);
      expect(km).toBeGreaterThan(1000);
      expect(km).toBeLessThan(1200);
    });

    it('returns 0 for identical points', () => {
      expect(haversineKm([6.5, 3.3], [6.5, 3.3])).toBe(0);
    });
  });

  describe('resolveDistance', () => {
    it('prefers OSRM and enforces the 5km floor', async () => {
      mockFetchSequence(
        [{ lat: '6.5', lon: '3.3' }],
        [{ lat: '6.51', lon: '3.31' }],
        { code: 'Ok', routes: [{ distance: 900 }] }, // 0.9km, below the floor
      );

      const { distanceKm, method } = await resolveDistance('A', 'B');

      expect(method).toBe('osrm');
      expect(distanceKm).toBe(5);
    });

    it('falls back to haversine when OSRM is unreachable', async () => {
      global.fetch = jest
        .fn()
        .mockImplementationOnce(async () => ({
          ok: true,
          status: 200,
          json: async () => [{ lat: '6.5244', lon: '3.3792' }],
        }))
        .mockImplementationOnce(async () => ({
          ok: true,
          status: 200,
          json: async () => [{ lat: '12.0022', lon: '8.592' }],
        }))
        .mockRejectedValueOnce(new Error('OSRM down'));

      const { method, distanceKm } = await resolveDistance('Lagos', 'Kano');

      expect(method).toBe('haversine');
      expect(distanceKm).toBeGreaterThan(5);
    });

    it('throws UnresolvableAddressError when the pickup address cannot be geocoded', async () => {
      mockFetchSequence([]);
      await expect(resolveDistance('Nowhere', 'Lagos')).rejects.toThrow(
        UnresolvableAddressError,
      );
    });

    it('throws UnresolvableAddressError when the delivery address cannot be geocoded', async () => {
      mockFetchSequence([{ lat: '6.5', lon: '3.3' }], []);
      await expect(resolveDistance('Lagos', 'Nowhere')).rejects.toThrow(
        UnresolvableAddressError,
      );
    });
  });
});
