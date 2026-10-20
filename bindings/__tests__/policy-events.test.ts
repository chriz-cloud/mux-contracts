import {
  POLICY_CONTRACT_TAG,
  POLICY_EVENT_TOPICS,
  parsePolicyEvent,
  type PolicyEvent,
} from "../src/policy-events";
import type { RawSorobanEvent } from "../src/factory-events";

const ADMIN = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFCT4";
const WALLET = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHK3M";
const LIMIT = "1000000000";
const AMOUNT = "500000000";
const DAY_LEDGERS = "17280";

function makeRawEvent(tag: string, action: string, data: unknown): RawSorobanEvent {
  return { topic: [tag, action], value: data };
}

describe("POLICY_CONTRACT_TAG", () => {
  it("equals 'mux_pol'", () => {
    expect(POLICY_CONTRACT_TAG).toBe("mux_pol");
  });
});

describe("POLICY_EVENT_TOPICS", () => {
  it("contains all documented actions", () => {
    expect(POLICY_EVENT_TOPICS.init).toBe("init");
    expect(POLICY_EVENT_TOPICS.lmt_set).toBe("lmt_set");
    expect(POLICY_EVENT_TOPICS.spent).toBe("spent");
    expect(POLICY_EVENT_TOPICS.ctr_rst).toBe("ctr_rst");
  });

  it("all topic values are ≤8 characters", () => {
    for (const v of Object.values(POLICY_EVENT_TOPICS)) {
      expect(v.length).toBeLessThanOrEqual(8);
    }
  });
});

describe("parsePolicyEvent — init", () => {
  it("parses init event", () => {
    const event = makeRawEvent(POLICY_CONTRACT_TAG, POLICY_EVENT_TOPICS.init, [ADMIN]);
    const result = parsePolicyEvent(event);
    expect(result).not.toBeNull();
    expect(result?.action).toBe("init");
    expect((result as any)?.admin).toBe(ADMIN);
  });
});

describe("parsePolicyEvent — lmt_set", () => {
  it("parses lmt_set event", () => {
    const event = makeRawEvent(POLICY_CONTRACT_TAG, POLICY_EVENT_TOPICS.lmt_set, [
      WALLET,
      LIMIT,
      DAY_LEDGERS,
    ]);
    const result = parsePolicyEvent(event);
    expect(result).not.toBeNull();
    expect(result?.action).toBe("lmt_set");
    expect((result as any)?.wallet).toBe(WALLET);
  });
});

describe("parsePolicyEvent — spent", () => {
  it("parses spent event", () => {
    const event = makeRawEvent(POLICY_CONTRACT_TAG, POLICY_EVENT_TOPICS.spent, [
      WALLET,
      AMOUNT,
    ]);
    const result = parsePolicyEvent(event);
    expect(result).not.toBeNull();
    expect(result?.action).toBe("spent");
  });
});

describe("parsePolicyEvent — ctr_rst", () => {
  it("parses ctr_rst event", () => {
    const event = makeRawEvent(POLICY_CONTRACT_TAG, POLICY_EVENT_TOPICS.ctr_rst, [WALLET]);
    const result = parsePolicyEvent(event);
    expect(result).not.toBeNull();
    expect(result?.action).toBe("ctr_rst");
  });
});

// ── wallet/amount shape validation (closes #996) ──────────────────────────────

describe("parsePolicyEvent — malformed wallet/amount shape (closes #996)", () => {
  it("rejects spent with a non-numeric amount", () => {
    const event = makeRawEvent(POLICY_CONTRACT_TAG, POLICY_EVENT_TOPICS.spent, [
      WALLET,
      "not-a-number",
    ]);
    expect(parsePolicyEvent(event)).toBeNull();
  });

  it("rejects spent with a fractional amount", () => {
    const event = makeRawEvent(POLICY_CONTRACT_TAG, POLICY_EVENT_TOPICS.spent, [
      WALLET,
      "100.5",
    ]);
    expect(parsePolicyEvent(event)).toBeNull();
  });

  it("rejects spent with a malformed wallet address", () => {
    const event = makeRawEvent(POLICY_CONTRACT_TAG, POLICY_EVENT_TOPICS.spent, [
      "not-a-valid-address",
      AMOUNT,
    ]);
    expect(parsePolicyEvent(event)).toBeNull();
  });

  it("rejects spent with a wallet address of the wrong length", () => {
    const event = makeRawEvent(POLICY_CONTRACT_TAG, POLICY_EVENT_TOPICS.spent, [
      WALLET.slice(0, -1),
      AMOUNT,
    ]);
    expect(parsePolicyEvent(event)).toBeNull();
  });

  it("rejects lmt_set with a non-numeric limit", () => {
    const event = makeRawEvent(POLICY_CONTRACT_TAG, POLICY_EVENT_TOPICS.lmt_set, [
      WALLET,
      "unlimited",
      DAY_LEDGERS,
    ]);
    expect(parsePolicyEvent(event)).toBeNull();
  });

  it("rejects lmt_set with a non-numeric dayLedgers", () => {
    const event = makeRawEvent(POLICY_CONTRACT_TAG, POLICY_EVENT_TOPICS.lmt_set, [
      WALLET,
      LIMIT,
      "forever",
    ]);
    expect(parsePolicyEvent(event)).toBeNull();
  });

  it("rejects lmt_set with a dayLedgers value beyond u32 range", () => {
    const event = makeRawEvent(POLICY_CONTRACT_TAG, POLICY_EVENT_TOPICS.lmt_set, [
      WALLET,
      LIMIT,
      "4294967296",
    ]);
    expect(parsePolicyEvent(event)).toBeNull();
  });

  it("accepts a well-formed spent event (sanity check)", () => {
    const event = makeRawEvent(POLICY_CONTRACT_TAG, POLICY_EVENT_TOPICS.spent, [
      WALLET,
      AMOUNT,
    ]);
    const result = parsePolicyEvent(event) as any;
    expect(result).not.toBeNull();
    expect(result.wallet).toBe(WALLET);
    expect(result.amount).toBe(AMOUNT);
  });
});

describe("parsePolicyEvent — returns null for non-policy events", () => {
  it("returns null for different contract tag", () => {
    const event = makeRawEvent("mux_other", POLICY_EVENT_TOPICS.init, [ADMIN]);
    expect(parsePolicyEvent(event)).toBeNull();
  });

  it("returns null for unknown action", () => {
    const event = makeRawEvent(POLICY_CONTRACT_TAG, "unknown", [ADMIN]);
    expect(parsePolicyEvent(event)).toBeNull();
  });

  it("returns null when data is null", () => {
    const event = makeRawEvent(POLICY_CONTRACT_TAG, POLICY_EVENT_TOPICS.init, null);
    expect(parsePolicyEvent(event)).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    const event = makeRawEvent(POLICY_CONTRACT_TAG, POLICY_EVENT_TOPICS.lmt_set, [WALLET]);
    expect(parsePolicyEvent(event)).toBeNull();
  });
});

// ── Stable-ABI literal-value assertions (closes #918) ─────────────────────────

describe("POLICY_CONTRACT_TAG literal value (closes #918)", () => {
  it("equals exactly 'mux_pol'", () => {
    expect(POLICY_CONTRACT_TAG).toBe("mux_pol");
  });
});

describe("POLICY_EVENT_TOPICS literal values (closes #918)", () => {
  it("deep-equals the four documented key/value pairs", () => {
    expect(POLICY_EVENT_TOPICS).toEqual({
      init: "init",
      lmt_set: "lmt_set",
      spent: "spent",
      ctr_rst: "ctr_rst",
    });
  });
});

// ── decodePolicyEvent strict decoder (closes #914) ────────────────────────────

import {
  decodePolicyEvent,
  PolicyEventDecodeError,
  type PolicyRawEvent,
} from "../src/policy-events";

describe("decodePolicyEvent — valid events (closes #914)", () => {
  it("decodes a valid init event with metadata", () => {
    const raw: PolicyRawEvent = {
      topic: [POLICY_CONTRACT_TAG, "init"],
      value: [ADMIN],
      id: "evt-1",
      ledger: 100,
    };
    const decoded = decodePolicyEvent(raw, { correlationId: "corr-1" });
    expect(decoded.action).toBe("init");
    expect((decoded as any).admin).toBe(ADMIN);
    expect(decoded.correlationId).toBe("corr-1");
    expect(decoded.eventId).toBe("evt-1");
    expect(decoded.ledger).toBe(100);
  });

  it("decodes a valid lmt_set event", () => {
    const raw: PolicyRawEvent = {
      topic: [POLICY_CONTRACT_TAG, "lmt_set"],
      value: [WALLET, LIMIT, DAY_LEDGERS],
    };
    const decoded = decodePolicyEvent(raw);
    expect(decoded.action).toBe("lmt_set");
    expect((decoded as any).wallet).toBe(WALLET);
    expect((decoded as any).limit).toBe(LIMIT);
    expect((decoded as any).dayLedgers).toBe(DAY_LEDGERS);
  });

  it("decodes a valid spent event", () => {
    const raw: PolicyRawEvent = {
      topic: [POLICY_CONTRACT_TAG, "spent"],
      value: [WALLET, AMOUNT],
    };
    const decoded = decodePolicyEvent(raw);
    expect(decoded.action).toBe("spent");
    expect((decoded as any).wallet).toBe(WALLET);
    expect((decoded as any).amount).toBe(AMOUNT);
  });

  it("decodes a valid ctr_rst event", () => {
    const raw: PolicyRawEvent = {
      topic: [POLICY_CONTRACT_TAG, "ctr_rst"],
      value: [WALLET],
    };
    const decoded = decodePolicyEvent(raw);
    expect(decoded.action).toBe("ctr_rst");
    expect((decoded as any).wallet).toBe(WALLET);
  });
});

describe("decodePolicyEvent — error cases (closes #914)", () => {
  it("throws PolicyEventDecodeError for an unknown action under mux_pol", () => {
    const raw: PolicyRawEvent = {
      topic: [POLICY_CONTRACT_TAG, "fee_charged"],
      value: [ADMIN],
    };
    expect(() => decodePolicyEvent(raw)).toThrow(PolicyEventDecodeError);
    try {
      decodePolicyEvent(raw);
    } catch (err: any) {
      expect(err.name).toBe("PolicyEventDecodeError");
      expect(err.action).toBe("fee_charged");
    }
  });

  it("throws PolicyEventDecodeError for a malformed payload on init (null data)", () => {
    const raw: PolicyRawEvent = {
      topic: [POLICY_CONTRACT_TAG, "init"],
      value: null,
    };
    expect(() => decodePolicyEvent(raw)).toThrow(PolicyEventDecodeError);
  });

  it("throws PolicyEventDecodeError for a malformed payload on lmt_set (missing fields)", () => {
    const raw: PolicyRawEvent = {
      topic: [POLICY_CONTRACT_TAG, "lmt_set"],
      value: [WALLET], // missing limit and dayLedgers
    };
    expect(() => decodePolicyEvent(raw)).toThrow(PolicyEventDecodeError);
  });

  it("throws PolicyEventDecodeError when topics[0] is not mux_pol", () => {
    const raw: PolicyRawEvent = {
      topic: ["mux_bat", "init"],
      value: [ADMIN],
    };
    expect(() => decodePolicyEvent(raw)).toThrow(PolicyEventDecodeError);
    try {
      decodePolicyEvent(raw);
    } catch (err: any) {
      expect(err.name).toBe("PolicyEventDecodeError");
    }
  });

  it("propagates correlationId on thrown errors", () => {
    const raw: PolicyRawEvent = {
      topic: [POLICY_CONTRACT_TAG, "bad_action"],
      value: [],
    };
    try {
      decodePolicyEvent(raw, { correlationId: "trace-xyz" });
    } catch (err: any) {
      expect(err.correlationId).toBe("trace-xyz");
    }
  });
});

// ── Shared canonical raw-event fixture (closes #997) ──────────────────────────

import {
  makeCanonicalRawEvent,
  CANONICAL_ACCOUNT,
  CANONICAL_AMOUNT,
} from "./fixtures/raw-event";

describe("parsePolicyEvent — canonical shared fixture (closes #997)", () => {
  it("parses a spent event built from the shared fixture", () => {
    const e = makeCanonicalRawEvent(POLICY_CONTRACT_TAG, POLICY_EVENT_TOPICS.spent, [
      CANONICAL_ACCOUNT,
      CANONICAL_AMOUNT,
    ]);
    const result = parsePolicyEvent(e as RawSorobanEvent) as any;
    expect(result).not.toBeNull();
    expect(result.wallet).toBe(CANONICAL_ACCOUNT);
    expect(result.amount).toBe(CANONICAL_AMOUNT);
  });

  it("rejects a spent event from the shared fixture with a malformed amount", () => {
    const e = makeCanonicalRawEvent(POLICY_CONTRACT_TAG, POLICY_EVENT_TOPICS.spent, [
      CANONICAL_ACCOUNT,
      "not-a-number",
    ]);
    expect(parsePolicyEvent(e as RawSorobanEvent)).toBeNull();
  });
});

describe("parsePolicyEvent unchanged behaviour after adding decodePolicyEvent (closes #914)", () => {
  it("still returns null for unknown action (never throws)", () => {
    const raw = makeRawEvent(POLICY_CONTRACT_TAG, "fee_charged", [ADMIN]);
    expect(parsePolicyEvent(raw)).toBeNull();
  });

  it("still returns null for malformed payload (never throws)", () => {
    const raw = makeRawEvent(POLICY_CONTRACT_TAG, "lmt_set", [WALLET]);
    expect(parsePolicyEvent(raw)).toBeNull();
  });

  it("still returns null for non-policy tag (never throws)", () => {
    const raw = makeRawEvent("mux_bat", "init", [ADMIN]);
    expect(parsePolicyEvent(raw)).toBeNull();
  });
});
