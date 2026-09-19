import { describe, expect, it } from "vitest";
import { RateLimiter } from "@/lib/api/rate-limiter";

describe("RateLimiter", () => {
  it("allows requests before any header has been seen (unknown quota is optimistic)", () => {
    const limiter = new RateLimiter("test-provider", ["x-requests-available"]);
    expect(limiter.canProceed()).toBe(true);
    expect(limiter.getRemaining()).toBeNull();
  });

  it("parses the first matching header name", () => {
    const limiter = new RateLimiter("test-provider", ["x-requests-available", "x-ratelimit-remaining"]);
    limiter.recordResponseHeaders(new Headers({ "x-requests-available": "5" }));
    expect(limiter.getRemaining()).toBe(5);
    expect(limiter.canProceed()).toBe(true);
  });

  it("falls back to a later header name when an earlier one is absent", () => {
    const limiter = new RateLimiter("test-provider", ["x-requests-available", "x-ratelimit-remaining"]);
    limiter.recordResponseHeaders(new Headers({ "x-ratelimit-remaining": "7" }));
    expect(limiter.getRemaining()).toBe(7);
  });

  it("stops blocking as soon as the quota reaches 0", () => {
    const limiter = new RateLimiter("test-provider", ["x-requests-available"]);
    limiter.recordResponseHeaders(new Headers({ "x-requests-available": "0" }));
    expect(limiter.getRemaining()).toBe(0);
    expect(limiter.canProceed()).toBe(false);
  });

  it("ignores a non-numeric header value and does not fall through to a later header name", () => {
    const limiter = new RateLimiter("test-provider", ["x-requests-available", "x-ratelimit-remaining"]);
    limiter.recordResponseHeaders(new Headers({ "x-requests-available": "not-a-number", "x-ratelimit-remaining": "5" }));
    expect(limiter.getRemaining()).toBeNull();
    expect(limiter.canProceed()).toBe(true);
  });

  it("does nothing when none of the configured header names are present", () => {
    const limiter = new RateLimiter("test-provider", ["x-requests-available"]);
    limiter.recordResponseHeaders(new Headers({ "content-type": "application/json" }));
    expect(limiter.getRemaining()).toBeNull();
  });
});
