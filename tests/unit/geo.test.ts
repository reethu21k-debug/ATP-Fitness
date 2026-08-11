import { describe, it, expect } from "vitest";
import { distanceMeters } from "@/lib/utils/geo";

describe("distanceMeters", () => {
  it("returns 0 for identical coordinates", () => {
    expect(distanceMeters(12.9352, 77.6146, 12.9352, 77.6146)).toBe(0);
  });

  it("computes a known real-world distance (Koramangala to Indiranagar, Bengaluru, ~4.9km)", () => {
    // Two real ATP Fitness demo-seed branch coordinates.
    const d = distanceMeters(12.9352, 77.6146, 12.9719, 77.6412);
    expect(d).toBeGreaterThan(4500);
    expect(d).toBeLessThan(5300);
  });

  it("computes a known long-distance pair (roughly Delhi to Mumbai, ~1150-1170km)", () => {
    const d = distanceMeters(28.6139, 77.209, 19.076, 72.8777);
    const km = d / 1000;
    expect(km).toBeGreaterThan(1100);
    expect(km).toBeLessThan(1200);
  });

  it("is symmetric regardless of point order", () => {
    const a = distanceMeters(12.9352, 77.6146, 12.9719, 77.6412);
    const b = distanceMeters(12.9719, 77.6412, 12.9352, 77.6146);
    expect(Math.abs(a - b)).toBeLessThan(0.001);
  });

  it("stays within a small radius for two points a few meters apart (GPS check-in scenario)", () => {
    // ~0.0009 degrees latitude is roughly 100m — used to sanity-check the
    // gym's default 150-200m check-in radius makes sense against real GPS drift.
    const d = distanceMeters(12.9352, 77.6146, 12.9361, 77.6146);
    expect(d).toBeGreaterThan(90);
    expect(d).toBeLessThan(110);
  });
});
