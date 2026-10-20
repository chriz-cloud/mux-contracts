/**
 * policy-events.ts — TypeScript helpers for consuming mux-policy
 * Soroban events.
 *
 * Every state-mutating policy entrypoint emits structured contract events
 * with a two-element topic vector:
 *
 *   topics[0]  "mux_pol"   — contract-family tag (Symbol)
 *   topics[1]  action name  — one of POLICY_EVENT_TOPICS (Symbol)
 *
 * Data payloads per action:
 *
 *   init      →  admin: Address
 *   lmt_set   →  (wallet: Address, limit: i128, day_ledgers: u32)
 *   spent     →  (wallet: Address, amount: i128)
 *   ctr_rst   →  wallet: Address
 *
 * See docs/audit-events.md and docs/event-topic-conventions.md for the
 * canonical event catalog.
 *
 * @module policy-events
 */

// ── Topic constants ────────────────────────────────────────────────────────────

/**
 * The contract-family tag emitted as `topics[0]` in every mux-policy
 * event. Use this when constructing Soroban RPC `getEvents` filters.
 */
export const POLICY_CONTRACT_TAG = "mux_pol" as const;

/**
 * Action names emitted as `topics[1]` in mux-policy events.
 * Values are stable ABI — renaming requires a breaking-change doc update.
 */
export const POLICY_EVENT_TOPICS = {
  /** Emitted by `initialize`. */
  init: "init",
  /** Emitted by `set_daily_limit`. */
  lmt_set: "lmt_set",
  /** Emitted by `record_spend`. */
  spent: "spent",
  /** Emitted by `reset_daily_counter`. */
  ctr_rst: "ctr_rst",
} as const;

export type PolicyEventAction = (typeof POLICY_EVENT_TOPICS)[keyof typeof POLICY_EVENT_TOPICS];

// ── Parsed event types ─────────────────────────────────────────────────────────

export interface PolicyInitEvent {
  action: "init";
  admin: string;
}

export interface PolicyLmtSetEvent {
  action: "lmt_set";
  wallet: string;
  limit: string;
  dayLedgers: string;
}

export interface PolicySpentEvent {
  action: "spent";
  wallet: string;
  amount: string;
}

export interface PolicyCtrRstEvent {
  action: "ctr_rst";
  wallet: string;
}

export type PolicyEvent =
  | PolicyInitEvent
  | PolicyLmtSetEvent
  | PolicySpentEvent
  | PolicyCtrRstEvent;

// ── Raw Soroban event shape (minimal — avoids importing the full SDK) ──────────

// Import shared RawSorobanEvent from factory-events to avoid duplication
import type { RawSorobanEvent } from "./factory-events";
import { normaliseData, resolveAddress } from "./event-decode";

// ── Strict-decoder types ───────────────────────────────────────────────────────

/**
 * Transaction-level metadata attached by {@link decodePolicyEvent}.
 * Mirrors {@link BatcherEventMeta} in batcher-events.ts.
 */
export interface PolicyEventMeta {
  /** Optional correlation id for tracing across logs. */
  correlationId?: string;
  /** Soroban RPC event id, when available. */
  eventId?: string;
  /** Ledger sequence the event was emitted in, when available. */
  ledger?: number;
  /** Emitting contract id, when available. */
  contractId?: string;
}

/** A policy event plus its correlation metadata. */
export type DecodedPolicyEvent = PolicyEvent & PolicyEventMeta;

/**
 * Raw event accepted by {@link decodePolicyEvent}. A superset of
 * {@link RawSorobanEvent} with optional RPC correlation fields.
 */
export interface PolicyRawEvent {
  topic: readonly unknown[];
  value: unknown;
  id?: string;
  ledger?: number;
  contractId?: string;
}

/**
 * Caller-supplied context for {@link decodePolicyEvent}.
 */
export interface PolicyEventContext {
  correlationId?: string;
  eventId?: string;
  ledger?: number;
  contractId?: string;
}

/**
 * Typed error thrown by {@link decodePolicyEvent} when a policy event cannot
 * be decoded. Fail-closed: a corrupted or unexpected event is surfaced to the
 * caller rather than silently dropped.
 */
export class PolicyEventDecodeError extends Error {
  /** The action from topics[1], when it could be read. */
  readonly action?: string;
  /** Optional correlation id for cross-log tracing. */
  readonly correlationId?: string;

  constructor(
    message: string,
    options: { action?: string; correlationId?: string } = {},
  ) {
    super(message);
    this.name = "PolicyEventDecodeError";
    this.action = options.action;
    this.correlationId = options.correlationId;
  }
}

const KNOWN_POLICY_ACTIONS = new Set<string>(Object.values(POLICY_EVENT_TOPICS));

/**
 * Decode a raw Soroban RPC event into a typed {@link DecodedPolicyEvent}.
 *
 * Fail-closed: throws {@link PolicyEventDecodeError} when:
 * - `topics[0]` is not `POLICY_CONTRACT_TAG` (non-policy event),
 * - the action (`topics[1]`) is unknown or absent, or
 * - the payload fails to resolve for the action.
 *
 * Use this for indexers that must not silently drop corrupt policy events.
 * For lenient filtering of a mixed stream, use {@link parsePolicyEvent}.
 *
 * @example
 * ```ts
 * import { decodePolicyEvent, PolicyEventDecodeError } from "./policy-events";
 *
 * for (const raw of rpcResponse.events) {
 *   try {
 *     const event = decodePolicyEvent(raw);
 *     index.add(event.correlationId, event);
 *   } catch (err) {
 *     if (err instanceof PolicyEventDecodeError) throw err;
 *   }
 * }
 * ```
 */
export function decodePolicyEvent(
  event: PolicyRawEvent,
  context: PolicyEventContext = {},
): DecodedPolicyEvent {
  const topics: readonly unknown[] = Array.isArray(event.topic) ? event.topic : [];
  const tag = typeof topics[0] === "string" ? topics[0] : null;

  if (tag !== POLICY_CONTRACT_TAG) {
    throw new PolicyEventDecodeError(
      `event topic[0] ${JSON.stringify(topics[0])} is not "${POLICY_CONTRACT_TAG}"`,
      { correlationId: context.correlationId },
    );
  }

  const action = typeof topics[1] === "string" ? topics[1] : null;
  if (action === null) {
    throw new PolicyEventDecodeError(
      `mux_pol event topic[1] ${JSON.stringify(topics[1])} is not a string action`,
      { correlationId: context.correlationId },
    );
  }
  if (!KNOWN_POLICY_ACTIONS.has(action)) {
    throw new PolicyEventDecodeError(
      `mux_pol action "${action}" is not one of: ${[...KNOWN_POLICY_ACTIONS].join(", ")}`,
      { action, correlationId: context.correlationId },
    );
  }

  const data = normaliseData(event.value);
  const errCtx = { action, correlationId: context.correlationId };

  let parsed: PolicyEvent;
  switch (action as PolicyEventAction) {
    case POLICY_EVENT_TOPICS.init: {
      const admin = data ? resolveAddress(data[0]) : null;
      if (!admin) throw new PolicyEventDecodeError(`mux_pol.init: missing or invalid admin address`, errCtx);
      parsed = { action: "init", admin };
      break;
    }
    case POLICY_EVENT_TOPICS.lmt_set: {
      const wallet = data ? resolveAddress(data[0]) : null;
      const limit = data ? resolveI128(data[1]) : null;
      const dayLedgers = data ? resolveU32(data[2]) : null;
      if (!wallet) throw new PolicyEventDecodeError(`mux_pol.lmt_set: missing or invalid wallet`, errCtx);
      if (!limit) throw new PolicyEventDecodeError(`mux_pol.lmt_set: missing or invalid limit`, errCtx);
      if (!dayLedgers) throw new PolicyEventDecodeError(`mux_pol.lmt_set: missing or invalid dayLedgers`, errCtx);
      parsed = { action: "lmt_set", wallet, limit, dayLedgers };
      break;
    }
    case POLICY_EVENT_TOPICS.spent: {
      const wallet = data ? resolveAddress(data[0]) : null;
      const amount = data ? resolveI128(data[1]) : null;
      if (!wallet) throw new PolicyEventDecodeError(`mux_pol.spent: missing or invalid wallet`, errCtx);
      if (!amount) throw new PolicyEventDecodeError(`mux_pol.spent: missing or invalid amount`, errCtx);
      parsed = { action: "spent", wallet, amount };
      break;
    }
    case POLICY_EVENT_TOPICS.ctr_rst: {
      const wallet = data ? resolveAddress(data[0]) : null;
      if (!wallet) throw new PolicyEventDecodeError(`mux_pol.ctr_rst: missing or invalid wallet`, errCtx);
      parsed = { action: "ctr_rst", wallet };
      break;
    }
    default:
      throw new PolicyEventDecodeError(`mux_pol: unhandled action "${action}"`, errCtx);
  }

  const meta: PolicyEventMeta = {};
  const correlationId = context.correlationId;
  if (correlationId !== undefined) meta.correlationId = correlationId;
  const eventId = context.eventId ?? event.id;
  if (eventId !== undefined) meta.eventId = eventId;
  const ledger = context.ledger ?? event.ledger;
  if (ledger !== undefined) meta.ledger = ledger;
  const contractId = context.contractId ?? event.contractId;
  if (contractId !== undefined) meta.contractId = contractId;

  return { ...parsed, ...meta };
}

// ── Parser ─────────────────────────────────────────────────────────────────────

/**
 * Parse a raw Soroban RPC event into a typed {@link PolicyEvent}.
 *
 * Returns `null` when the event does not match the policy's contract tag or
 * when the action is unrecognised.
 *
 * @example
 * ```ts
 * import { parsePolicyEvent, POLICY_CONTRACT_TAG } from "./policy-events";
 *
 * const rawEvents = await server.getEvents({ startLedger, filters: [...] });
 * const policyEvents = rawEvents.records
 *   .map(parsePolicyEvent)
 *   .filter((e): e is PolicyEvent => e !== null);
 * ```
 */
export function parsePolicyEvent(event: RawSorobanEvent): PolicyEvent | null {
  const [tag, action] = event.topic ?? [];

  if (tag !== POLICY_CONTRACT_TAG) return null;

  const data = normaliseData(event.value);
  if (!data) return null;

  switch (action as PolicyEventAction) {
    case POLICY_EVENT_TOPICS.init: {
      const admin = resolveAddress(data[0]);
      if (!admin) return null;
      return { action: "init", admin };
    }

    case POLICY_EVENT_TOPICS.lmt_set: {
      const wallet = resolveAddress(data[0]);
      const limit = resolveI128(data[1]);
      const dayLedgers = resolveU32(data[2]);
      if (!wallet || !limit || !dayLedgers) return null;
      return { action: "lmt_set", wallet, limit, dayLedgers };
    }

    case POLICY_EVENT_TOPICS.spent: {
      const wallet = resolveAddress(data[0]);
      const amount = resolveI128(data[1]);
      if (!wallet || !amount) return null;
      return { action: "spent", wallet, amount };
    }

    case POLICY_EVENT_TOPICS.ctr_rst: {
      const wallet = resolveAddress(data[0]);
      if (!wallet) return null;
      return { action: "ctr_rst", wallet };
    }

    default:
      return null;
  }
}

// ── Internal helpers ───────────────────────────────────────────────────────────

// Soroban i128 is a signed 128-bit integer; accept only a well-formed
// (optionally negative) decimal digit string so a malformed/non-numeric
// field (e.g. "abc", "1.5", "") can never be mistaken for a valid amount
// or limit.
const I128_RE = /^-?\d+$/;

function resolveI128(raw: unknown): string | null {
  if (typeof raw === "number") {
    return Number.isInteger(raw) ? String(raw) : null;
  }
  if (typeof raw === "string") {
    return I128_RE.test(raw) ? raw : null;
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if ("i128" in obj) return resolveI128(obj["i128"]);
  }
  return null;
}

/** Inclusive upper bound of the unsigned 32-bit range. */
const U32_MAX = 0xffff_ffff;

function resolveU32(raw: unknown): string | null {
  if (typeof raw === "number") {
    if (!Number.isInteger(raw) || raw < 0 || raw > U32_MAX) return null;
    return String(raw);
  }
  if (typeof raw === "string") {
    if (!/^\d{1,10}$/.test(raw)) return null;
    const n = Number(raw);
    return n <= U32_MAX ? String(n) : null;
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if ("u32" in obj) return resolveU32(obj["u32"]);
  }
  return null;
}
