import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateCompatClient = vi.hoisted(() => vi.fn(() => ({})));

vi.mock("./compat", () => ({
  createCompatClient: mockCreateCompatClient,
}));

import { createClient } from "./client";

describe("InsForge browser client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_INSFORGE_URL = "https://test.insforge.app";
    process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY = "anon-key";
  });

  it("requests mobile auth responses so password auth returns refresh tokens", () => {
    createClient();

    expect(mockCreateCompatClient).toHaveBeenCalledWith({
      baseUrl: "https://test.insforge.app",
      anonKey: "anon-key",
      isServerMode: true,
    });
  });
});
