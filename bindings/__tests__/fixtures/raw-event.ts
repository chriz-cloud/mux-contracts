/**
 * raw-event.ts — Shared canonical raw-event fixture for the bindings event
 * decoder test suites (closes #997).
 *
 * Every `*-events.test.ts` suite previously hand-rolled its own
 * `makeRawEvent` helper and its own ad-hoc address/amount constants. That
 * duplication meant each suite could drift to a slightly different raw-event
 * shape, so a decoder bug that only showed up for one particular shape (e.g.
 * object-style vs. array-style `value`) could slip past suites that never
 * exercised it.
 *
 * This module provides ONE canonical raw-event builder plus one canonical
 * set of fixture values (addresses, amounts, counts) that every parser test
 * suite can import, so they are all checked against the same baseline shape.
 */

/** Minimal raw Soroban event shape accepted by every bindings event parser. */
export interface CanonicalRawEvent {
  topic: readonly unknown[];
  value: unknown;
  id?: string;
  txHash?: string;
  ledger?: number;
  eventIndex?: number;
  contractId?: string;
}

/**
 * Build a canonical raw Soroban RPC event with a two-element topic vector
 * (`[contractTag, action]`) and an array-style data payload — the shape every
 * bindings parser (`parseFactoryEvent`, `parseBatcherEvent`, `parsePolicyEvent`,
 * `parseRegistryEvent`, …) is documented to accept.
 */
export function makeCanonicalRawEvent(
  tag: string,
  action: string,
  data: unknown,
  extra: Partial<CanonicalRawEvent> = {},
): CanonicalRawEvent {
  return { topic: [tag, action], value: data, ...extra };
}

// ── Canonical fixture values ────────────────────────────────────────────────
//
// One fixed pair of valid G…/C… strkey addresses, reused by every suite
// instead of each file minting its own. Both are syntactically valid 56-char
// Stellar contract-address strkeys.

export const CANONICAL_OWNER = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFCT4";
export const CANONICAL_ACCOUNT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHK3M";

/** Canonical semver-valid version string for `meta_set` / registry events. */
export const CANONICAL_VERSION = "1.0.0";

/** Canonical decimal-string numeric fixtures for u32 / i128 payload fields. */
export const CANONICAL_OP_COUNT = "5";
export const CANONICAL_SUCCESS_COUNT = "4";
export const CANONICAL_FAILURE_COUNT = "1";
export const CANONICAL_AMOUNT = "500000000";
export const CANONICAL_LIMIT = "1000000000";
export const CANONICAL_DAY_LEDGERS = "17280";

/** Canonical 64-char lowercase hex transaction hash fixture. */
export const CANONICAL_TX_HASH = "a".repeat(64);
