/**
 * RateLimiter Tests
 */

import { RateLimiter } from "../RateLimiter";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      perMinute: 10,
      perHour: 100,
      perDay: 1000,
    });
  });

  describe("canProceed", () => {
    it("should allow first call", () => {
      expect(limiter.canProceed("user1", "api/translate")).toBe(true);
    });

    it("should allow multiple calls within limit", () => {
      for (let i = 0; i < 9; i++) {
        limiter.recordCall("user1", "api/translate");
      }
      expect(limiter.canProceed("user1", "api/translate")).toBe(true);
    });

    it("should block call when minute limit exceeded", () => {
      for (let i = 0; i < 10; i++) {
        limiter.recordCall("user1", "api/translate");
      }
      expect(limiter.canProceed("user1", "api/translate")).toBe(false);
    });

    it("should track separate endpoints", () => {
      limiter.recordCall("user1", "api/translate");
      limiter.recordCall("user1", "api/analyze");
      expect(limiter.canProceed("user1", "api/translate")).toBe(true);
      expect(limiter.canProceed("user1", "api/analyze")).toBe(true);
    });
  });

  describe("getRemainingQuota", () => {
    it("should show full quota initially", () => {
      const quota = limiter.getRemainingQuota("user1", "api/translate");
      expect(quota.remaining).toBe(1000);
      expect(quota.percentUsed).toBe(0);
    });

    it("should track used quota", () => {
      limiter.recordCall("user1", "api/translate");
      limiter.recordCall("user1", "api/translate");
      const quota = limiter.getRemainingQuota("user1", "api/translate");
      expect(quota.used).toBe(2);
      expect(quota.remaining).toBe(998);
    });

    it("should calculate percent used", () => {
      for (let i = 0; i < 500; i++) {
        limiter.recordCall("user1", "api/translate");
      }
      const quota = limiter.getRemainingQuota("user1", "api/translate");
      expect(quota.percentUsed).toBe(50);
    });
  });

  describe("isAtWarningLevel", () => {
    it("should return false when below 80%", () => {
      for (let i = 0; i < 400; i++) {
        limiter.recordCall("user1", "api/translate");
      }
      expect(limiter.isAtWarningLevel("user1", "api/translate")).toBe(false);
    });

    it("should return true when at 80% or higher", () => {
      for (let i = 0; i < 850; i++) {
        limiter.recordCall("user1", "api/translate");
      }
      expect(limiter.isAtWarningLevel("user1", "api/translate")).toBe(true);
    });
  });

  describe("isExhausted", () => {
    it("should return false when quota remaining", () => {
      for (let i = 0; i < 500; i++) {
        limiter.recordCall("user1", "api/translate");
      }
      expect(limiter.isExhausted("user1", "api/translate")).toBe(false);
    });

    it("should return true when quota exhausted", () => {
      for (let i = 0; i < 1000; i++) {
        limiter.recordCall("user1", "api/translate");
      }
      expect(limiter.isExhausted("user1", "api/translate")).toBe(true);
    });
  });

  describe("resetQuota", () => {
    it("should reset quota", () => {
      for (let i = 0; i < 500; i++) {
        limiter.recordCall("user1", "api/translate");
      }
      let quota = limiter.getRemainingQuota("user1", "api/translate");
      expect(quota.used).toBe(500);

      limiter.resetQuota("user1", "api/translate");
      quota = limiter.getRemainingQuota("user1", "api/translate");
      expect(quota.used).toBe(0);
    });
  });

  describe("export / import", () => {
    it("should export and import quotas", () => {
      limiter.recordCall("user1", "api/translate");
      limiter.recordCall("user1", "api/analyze");

      const exported = limiter.export();
      expect(Object.keys(exported).length).toBe(2);

      const limiter2 = new RateLimiter();
      limiter2.import(exported);

      const quota = limiter2.getRemainingQuota("user1", "api/translate");
      expect(quota.used).toBe(1);
    });
  });
});
