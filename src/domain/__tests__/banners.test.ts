import { describe, expect, it } from 'vitest';
import {
  BANNERS,
  BANNER_ID_PATTERN,
  STRIP_HEIGHT_PX,
  bannerById,
  bannerGradient,
} from '../banners';

const HEX = /^#[0-9A-F]{6}$/;

describe('BANNERS', () => {
  it('has unique ids', () => {
    const ids = BANNERS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // The same pattern as the profiles_banner_format check constraint in
  // migration 0008. If these drift, the picker offers a banner the database
  // refuses to store and the tap fails with a constraint violation.
  it('has ids the database will accept', () => {
    for (const banner of BANNERS) {
      expect(banner.id, banner.id).toMatch(BANNER_ID_PATTERN);
    }
  });

  it('has well-formed stops and a name', () => {
    for (const banner of BANNERS) {
      expect(banner.name.length, banner.id).toBeGreaterThan(0);
      expect(banner.stops.length, banner.id).toBeGreaterThanOrEqual(2);
      for (const stop of banner.stops) {
        expect(stop, `${banner.id} stop ${stop}`).toMatch(HEX);
      }
    }
  });

  /**
   * The strip animates by sliding its own gradient sideways and wrapping. If
   * the first and last stop differ, the wrap is a visible hard cut every few
   * seconds — which reads as a rendering bug rather than a style.
   */
  it('loops seamlessly', () => {
    for (const banner of BANNERS) {
      expect(banner.stops[0], banner.id).toBe(banner.stops[banner.stops.length - 1]);
    }
  });

  it('reserves a strip height', () => {
    expect(STRIP_HEIGHT_PX).toBeGreaterThan(0);
  });
});

describe('bannerById', () => {
  it('finds a banner by id', () => {
    expect(bannerById('nebula')?.name).toBe('Nebula');
  });

  it.each([null, undefined, '', 'a-banner-we-dropped'])('returns null for %p', (id) => {
    expect(bannerById(id)).toBeNull();
  });
});

describe('bannerGradient', () => {
  it('builds a gradient from the stops in order', () => {
    expect(bannerGradient(bannerById('nebula')!)).toBe(
      'linear-gradient(100deg, #5B1D8E, #B87BEA, #7A2DB5, #45156B, #5B1D8E)'
    );
  });
});
