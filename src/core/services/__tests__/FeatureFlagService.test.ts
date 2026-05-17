/**
 * FeatureFlagService Tests
 */

import { FeatureFlagService } from "../FeatureFlagService";

describe("FeatureFlagService", () => {
  let service: FeatureFlagService;

  beforeEach(() => {
    service = new FeatureFlagService();
  });

  afterEach(() => {
    service.dispose();
  });

  describe("isEnabled", () => {
    it("should return true for enabled features", () => {
      expect(service.isEnabled("translation")).toBe(true);
      expect(service.isEnabled("aiCompletion")).toBe(true);
    });

    it("should respect initial config", () => {
      const service2 = new FeatureFlagService({
        translation: false,
      });
      expect(service2.isEnabled("translation")).toBe(false);
      expect(service2.isEnabled("aiCompletion")).toBe(true);
      service2.dispose();
    });
  });

  describe("enable / disable", () => {
    it("should enable disabled feature", () => {
      service.disable("translation");
      expect(service.isEnabled("translation")).toBe(false);
      service.enable("translation");
      expect(service.isEnabled("translation")).toBe(true);
    });

    it("should disable enabled feature", () => {
      expect(service.isEnabled("aiCompletion")).toBe(true);
      service.disable("aiCompletion");
      expect(service.isEnabled("aiCompletion")).toBe(false);
    });

    it("should not duplicate events", (done) => {
      let eventCount = 0;
      service.onFlagChange(() => eventCount++);
      service.enable("translation"); // Already enabled, shouldn't fire
      expect(eventCount).toBe(0);
      service.disable("translation"); // Now disabled, should fire
      expect(eventCount).toBe(1);
      done();
    });
  });

  describe("toggle", () => {
    it("should toggle enabled features", () => {
      const initial = service.isEnabled("translation");
      service.toggle("translation");
      expect(service.isEnabled("translation")).toBe(!initial);
    });
  });

  describe("getFlags", () => {
    it("should return copy of flags", () => {
      const flags = service.getFlags();
      flags.translation = false as any;
      expect(service.isEnabled("translation")).toBe(true);
    });
  });

  describe("setFlags", () => {
    it("should set multiple flags", () => {
      service.setFlags({
        translation: false,
        aiCompletion: false,
      });
      expect(service.isEnabled("translation")).toBe(false);
      expect(service.isEnabled("aiCompletion")).toBe(false);
    });
  });

  describe("guard", () => {
    it("should execute function if feature enabled", () => {
      const fn = jest.fn().mockReturnValue("result");
      const result = service.guard("translation", fn);
      expect(fn).toHaveBeenCalled();
      expect(result).toBe("result");
    });

    it("should not execute function if feature disabled", () => {
      service.disable("translation");
      const fn = jest.fn();
      service.guard("translation", fn);
      expect(fn).not.toHaveBeenCalled();
    });

    it("should return fallback if feature disabled", () => {
      service.disable("translation");
      const result = service.guard("translation", () => "result", "fallback");
      expect(result).toBe("fallback");
    });
  });

  describe("guardAsync", () => {
    it("should execute async function if feature enabled", async () => {
      const fn = jest.fn().mockResolvedValue("result");
      const result = await service.guardAsync("translation", fn);
      expect(fn).toHaveBeenCalled();
      expect(result).toBe("result");
    });

    it("should not execute async function if feature disabled", async () => {
      service.disable("translation");
      const fn = jest.fn();
      await service.guardAsync("translation", fn);
      expect(fn).not.toHaveBeenCalled();
    });
  });
});
