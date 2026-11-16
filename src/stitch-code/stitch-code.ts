// Creating and opening stitch codes (stitch-code Req 2, 3, 5), following the flows in design.md:
//   create: payload JSON -> deflate-raw -> fresh salt and IV -> PBKDF2-HMAC-SHA256 (600,000)
//           -> AES-GCM with the 36 header bytes as additional data -> header || ciphertext
//   open:   decodeHeader (magic, version, KDF, 600,000 <= iterations <= 10,000,000)
//           -> PBKDF2 with the header's count -> AES-GCM decrypt -> inflate-raw (64 KiB cap)
//           -> payload schema check -> answers -> mapAnswers
// Wrong passphrase, any changed byte, oversized or invalid content all give "cannot-open" with
// no partial data (Req 5.2). Nothing here logs or keeps the passphrase (Req 1.5).

import type { Answer, FormModel, MappingResult } from '../form-model';
import { mapAnswers } from '../mapping';
import type { ValidationContext } from '../validation';
import { deflateRaw, inflateRaw } from './compress';
import { deriveKey, normalisePassphrase, open, randomBytes, seal } from './crypto';
import {
  DEFAULT_ITERATIONS,
  ITERATION_BOUNDS,
  IV_BYTES,
  SALT_BYTES,
  decodeHeader,
  encodeHeader,
  joinStitchCode,
  type Bytes,
  type IterationBounds,
} from './format';
import { fromPayload, payloadFromResult, toAnswers, toPayload, type StitchPayload } from './payload';

/** "too-large": the answers come to more than 64 KiB, so the code could never be opened (Req 3.4). */
export type CreateResult = { ok: true; bytes: Bytes } | { ok: false; code: 'too-large' };

/** "not-stitch-code" shows the Req 5.4 message; "cannot-open" shows the Req 5.2 message. */
export type OpenFailure = { ok: false; code: 'not-stitch-code' } | { ok: false; code: 'cannot-open' };

export interface OpenedStitchCode {
  formId: string;
  /** Prompted answers with source "stitch-code", in stored order. */
  answers: Answer[];
}

export type OpenResult = ({ ok: true } & OpenedStitchCode) | OpenFailure;

export type OpenPayloadResult = { ok: true; payload: StitchPayload } | OpenFailure;

export type RefillOutcome =
  | { status: 'refilled'; result: MappingResult }
  | { status: 'other-form'; formId: string };

/**
 * Seal a payload with an explicit PBKDF2 iteration count. Internal: production code calls
 * createStitchCode, which always passes DEFAULT_ITERATIONS. Tests use a low count to stay fast
 * (design.md, P3). Throws RangeError for an empty passphrase, a programming error because the
 * passphrase dialog never allows one.
 */
export async function sealWithIterations(payload: StitchPayload, passphrase: string, iterations: number): Promise<CreateResult> {
  if (normalisePassphrase(passphrase) === '') throw new RangeError('a passphrase is required');
  const packed = await deflateRaw(toPayload(payload.formId, payload.answers));
  if (!packed.ok) return packed;
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const header = encodeHeader(iterations, salt, iv);
  const key = await deriveKey(passphrase, salt, iterations);
  return { ok: true, bytes: joinStitchCode(header, await seal(key, iv, header, packed.bytes)) };
}

/**
 * Open a stitch code, accepting iteration counts within `bounds`. Internal: production code
 * calls openStitchCode, which uses ITERATION_BOUNDS (Req 2.4). A header that fails the checks
 * is rejected before any key is derived.
 */
export async function openWithBounds(bytes: Uint8Array, passphrase: string, bounds: IterationBounds): Promise<OpenPayloadResult> {
  const decoded = decodeHeader(bytes, bounds);
  if (!decoded.ok) return { ok: false, code: 'not-stitch-code' };
  const { header, headerBytes, sealed } = decoded;
  const cannotOpen: OpenFailure = { ok: false, code: 'cannot-open' };
  const key = await deriveKey(passphrase, header.salt, header.iterations);
  const plain = await open(key, header.iv, headerBytes, sealed);
  if (!plain.ok) return cannotOpen;
  const inflated = await inflateRaw(plain.bytes);
  if (!inflated.ok) return cannotOpen;
  const parsed = fromPayload(inflated.bytes);
  return parsed.ok ? parsed : cannotOpen;
}

/**
 * Create a stitch code from the current mapping result: only the form ID and the text entered
 * per field go in (Req 3.1, 3.2), compressed (Req 3.3) and encrypted with a key derived with
 * 600,000 PBKDF2 iterations, a fresh salt and a fresh IV (Req 2.1 to 2.3).
 */
export function createStitchCode(result: MappingResult, passphrase: string): Promise<CreateResult> {
  return sealWithIterations(payloadFromResult(result), passphrase, DEFAULT_ITERATIONS);
}

/** Open a stitch code with the passphrase and return exactly the answers it holds (Req 5.1, 5.2, 5.4). */
export async function openStitchCode(bytes: Uint8Array, passphrase: string): Promise<OpenResult> {
  const r = await openWithBounds(bytes, passphrase, ITERATION_BOUNDS);
  return r.ok ? { ok: true, formId: r.payload.formId, answers: toAnswers(r.payload) } : r;
}

/**
 * Refill `form` by running the mapper on the opened answers (Req 5.1). If the stitch code
 * belongs to a different form, nothing is mapped and the caller gets that form's ID so it can
 * name the form and ask first (Req 5.3). Calling again with `confirmedOtherForm` maps anyway;
 * answers for fields this form does not have then go to `unmatched`.
 */
export function refillForm(
  form: FormModel,
  opened: OpenedStitchCode,
  signatures: ReadonlySet<string>,
  ctx: ValidationContext,
  confirmedOtherForm = false,
): RefillOutcome {
  if (opened.formId !== form.id && !confirmedOtherForm) return { status: 'other-form', formId: opened.formId };
  return { status: 'refilled', result: mapAnswers(form, opened.answers, signatures, ctx) };
}
