import { describe, expect, it, vi } from "vitest";
import { clip, sendSms, smsConfigFromEnv } from "@/lib/sms";

describe("sms", () => {
  it("sans configuration : simulé", async () => {
    expect(smsConfigFromEnv({})).toBeNull();
    expect(await sendSms(null, "+21622000000", "x")).toEqual({ status: "SIMULATED" });
  });
  it("envoie au fournisseur configuré", async () => {
    const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 }));
    const cfg = smsConfigFromEnv({ SMS_API_URL: "https://sms.example/send", SMS_API_TOKEN: "k", SMS_SENDER: "ECOLE" })!;
    expect(await sendSms(cfg, "+21622000000", "Bonjour", fetchImpl as unknown as typeof fetch)).toEqual({ status: "SENT" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://sms.example/send");
    expect(JSON.parse(init.body as string)).toEqual({ to: "+21622000000", from: "ECOLE", text: "Bonjour" });
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer k");
  });
  it("échec réseau ou HTTP", async () => {
    const cfg = { url: "https://sms.example" };
    const bad = vi.fn(async () => new Response("no", { status: 500 }));
    expect(await sendSms(cfg, "1", "x", bad as unknown as typeof fetch)).toEqual({ status: "FAILED", error: "HTTP 500" });
    const boom = vi.fn(async () => { throw new Error("down"); });
    expect(await sendSms(cfg, "1", "x", boom as unknown as typeof fetch)).toEqual({ status: "FAILED", error: "down" });
  });
  it("raccourcit les textes longs", () => {
    expect(clip("a  b\n c")).toBe("a b c");
    expect(clip("x".repeat(10), 5)).toBe("xxxx…");
  });
});
