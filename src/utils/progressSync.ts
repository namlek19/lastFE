import LZString from 'lz-string';
import {
  ExamHistoryItem,
  QuestionProgress,
  StudyMode,
  StudyTier,
  SubjectId,
  UserProgressStore,
} from '../types/quiz';
import { isMastered, normalizeSubject, normalizeTier } from './storage';

const CODE_PREFIX_V4 = 'OT4-';

const MAX_SYNC_SLOTS_V2 = 1000; // Legacy V2: 0..499 = vnr, 500..999 = mln
const MAX_SYNC_SLOTS_V3 = 1500; // Legacy V3: 0..499 = vnr, 500..999 = mln, 1000..1499 = wdu
const MAX_SYNC_SLOTS_V4 = 2500; // V4: + 1500..1999 = mln12, 2000..2499 = wdu2
const VNR_SLOT_OFFSET = 0;
const MLN_SLOT_OFFSET = 500;
const WDU_SLOT_OFFSET = 1000;
const MLN12_SLOT_OFFSET = 1500;
const WDU2_SLOT_OFFSET = 2000;
const EPOCH_SEC_2025 = Math.floor(Date.UTC(2025, 0, 1) / 1000);

const SUBJECT_LIST: readonly SubjectId[] = ['vnr202', 'mln131', 'wdu203c', 'mln122', 'wdu202c'];
const MODE_LIST: readonly StudyMode[] = ['chapter', 'rolling', 'flashcard', 'exam'];
const TIER_LIST: readonly StudyTier[] = ['hardcore', 'lazy', 'lazymax'];

type CompactTuple = [string, number, 0 | 1, 0 | 1 | 2, number, number, (0 | 1)?];

interface CompactSyncPayload {
  v: 1;
  s: SubjectId;
  m: StudyMode;
  t?: StudyTier;
  q: CompactTuple[];
  h: ExamHistoryItem[];
}

// 3-bit per-question state values (0..5)
type SyncQuestionStateCode = 0 | 1 | 2 | 3 | 4 | 5;

function questionIdToSlot(id: string): number {
  const match = /^(vnr|mln12|mln|wdu2|wdu)-(\d+)$/i.exec(id);
  if (!match) return -1;
  const num = Number.parseInt(match[2], 10);
  if (!Number.isFinite(num) || num < 1 || num > 500) return -1;
  const prefix = match[1].toLowerCase();
  const base =
    prefix === 'vnr'
      ? VNR_SLOT_OFFSET
      : prefix === 'mln'
        ? MLN_SLOT_OFFSET
        : prefix === 'wdu'
          ? WDU_SLOT_OFFSET
          : prefix === 'mln12'
            ? MLN12_SLOT_OFFSET
            : WDU2_SLOT_OFFSET;
  return base + (num - 1);
}

function slotToQuestionId(slot: number, maxSlots = MAX_SYNC_SLOTS_V4): string | null {
  if (slot < 0 || slot >= maxSlots) return null;
  if (slot < MLN_SLOT_OFFSET) {
    return `vnr-${String(slot + 1).padStart(3, '0')}`;
  }
  if (slot < WDU_SLOT_OFFSET) {
    return `mln-${String(slot - MLN_SLOT_OFFSET + 1).padStart(3, '0')}`;
  }
  if (slot < MLN12_SLOT_OFFSET) {
    return `wdu-${String(slot - WDU_SLOT_OFFSET + 1).padStart(3, '0')}`;
  }
  if (slot < WDU2_SLOT_OFFSET) {
    return `mln12-${String(slot - MLN12_SLOT_OFFSET + 1).padStart(3, '0')}`;
  }
  return `wdu2-${String(slot - WDU2_SLOT_OFFSET + 1).padStart(3, '0')}`;
}

function progressToStateCode(p?: QuestionProgress): SyncQuestionStateCode {
  if (!p) return 0;
  if (p.flagged) return 3;
  if (p.streak >= 2) return 4;
  if (p.streak === 1) return 2;
  if (p.studied) return 1;
  if (p.lastResult === 'wrong') return 5;
  return 0;
}

function stateCodeToProgress(code: number): QuestionProgress | null {
  switch (code) {
    case 1:
      return { streak: 0, flagged: false, correctCount: 0, attemptCount: 0, studied: true };
    case 2:
      return {
        streak: 1,
        flagged: false,
        lastResult: 'correct',
        correctCount: 1,
        attemptCount: 1,
        studied: true,
      };
    case 3:
      return { streak: 0, flagged: true, correctCount: 0, attemptCount: 0, studied: true };
    case 4:
      return {
        streak: 2,
        flagged: false,
        lastResult: 'correct',
        correctCount: 2,
        attemptCount: 2,
        studied: true,
      };
    case 5:
      return {
        streak: 0,
        flagged: false,
        lastResult: 'wrong',
        correctCount: 0,
        attemptCount: 1,
        studied: false,
      };
    default:
      return null;
  }
}

function pushVarint(out: number[], value: number): void {
  let v = Math.max(0, Math.floor(value)) >>> 0;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
}

function readVarint(bytes: Uint8Array, cursor: { pos: number }): number | null {
  let result = 0;
  let shift = 0;
  while (cursor.pos < bytes.length) {
    const byte = bytes[cursor.pos++];
    result += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) {
      return result;
    }
    shift += 7;
    if (shift > 35) return null;
  }
  return null;
}

function computeCrc8(bytes: readonly number[] | Uint8Array, length: number): number {
  let crc = 0x5a;
  for (let i = 0; i < length; i++) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x80 ? ((crc << 1) ^ 0x31) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}

function encodeBase64Url(bytes: readonly number[]): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(str: string): Uint8Array | null {
  try {
    if (!/^[A-Za-z0-9\-_]+$/.test(str)) return null;
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padLen);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function encodeSparseRle(slots: Uint8Array): number[] {
  const runs: Array<{ start: number; len: number; state: number }> = [];
  let i = 0;
  while (i < slots.length) {
    const st = slots[i];
    if (st === 0) {
      i++;
      continue;
    }
    let j = i + 1;
    while (j < slots.length && slots[j] === st) {
      j++;
    }
    runs.push({ start: i, len: j - i, state: st });
    i = j;
  }

  const out: number[] = [];
  pushVarint(out, runs.length);
  let prevEnd = 0;
  for (const run of runs) {
    pushVarint(out, run.start - prevEnd);
    if (run.len <= 16) {
      out.push(((run.state & 0x07) << 5) | (run.len - 1));
    } else {
      const rem = run.len - 17;
      out.push(((run.state & 0x07) << 5) | 0x10 | ((rem >> 8) & 0x0f));
      out.push(rem & 0xff);
    }
    prevEnd = run.start + run.len;
  }
  return out;
}

function encodeDenseBitstream(slots: Uint8Array): number[] {
  let lastNonZero = -1;
  for (let i = slots.length - 1; i >= 0; i--) {
    if (slots[i] !== 0) {
      lastNonZero = i;
      break;
    }
  }
  const slotCount = lastNonZero + 1;
  const out: number[] = [];
  pushVarint(out, slotCount);
  if (slotCount === 0) return out;

  const bitBytesLen = Math.ceil((slotCount * 3) / 8);
  const packed = new Uint8Array(bitBytesLen);
  for (let i = 0; i < slotCount; i++) {
    const val = slots[i] & 0x07;
    if (val === 0) continue;
    const bitPos = i * 3;
    const byteIdx = bitPos >> 3;
    const bitOff = bitPos & 7;
    packed[byteIdx] |= (val << bitOff) & 0xff;
    if (bitOff > 5 && byteIdx + 1 < packed.length) {
      packed[byteIdx + 1] |= val >> (8 - bitOff);
    }
  }
  for (let i = 0; i < packed.length; i++) {
    out.push(packed[i]);
  }
  return out;
}

function encodeExamHistoryBytesV4(history: ExamHistoryItem[]): number[] {
  const capped = history.slice(0, 30);
  const out: number[] = [capped.length];

  for (const item of capped) {
    const entries = Object.entries(item.chapterBreakdown ?? {})
      .map(([ch, stats]) => [Number(ch), stats.correct, stats.total] as const)
      .filter(([ch]) => Number.isFinite(ch) && ch >= 0 && ch <= 15)
      .slice(0, 15);

    const subjIdx = Math.max(0, SUBJECT_LIST.indexOf(item.subject));
    const typeBit = item.examType === 'mastered' ? 1 : 0;
    const metaByte = (subjIdx & 0x07) | (typeBit << 3) | ((entries.length & 0x0f) << 4);
    out.push(metaByte);

    const tsSec = Math.max(0, Math.round(item.timestamp / 1000) - EPOCH_SEC_2025);
    pushVarint(out, tsSec);
    pushVarint(out, Math.max(0, Math.round(item.totalQuestions)));
    pushVarint(out, Math.max(0, Math.round(item.correctCount)));
    pushVarint(out, Math.max(0, Math.round(item.durationSeconds)));

    for (const [ch, chCorrect, chTotal] of entries) {
      out.push(ch & 0x0f);
      pushVarint(out, Math.max(0, Math.round(chCorrect)));
      pushVarint(out, Math.max(0, Math.round(chTotal)));
    }
  }

  return out;
}

export function exportProgressCode(store: UserProgressStore): string {
  const slots = new Uint8Array(MAX_SYNC_SLOTS_V4);
  for (const [id, p] of Object.entries(store.questions)) {
    const slot = questionIdToSlot(id);
    if (slot >= 0) {
      slots[slot] = progressToStateCode(p);
    }
  }

  const sparseBytes = encodeSparseRle(slots);
  const denseBytes = encodeDenseBitstream(slots);
  const useDense = denseBytes.length < sparseBytes.length;
  const questionBytes = useDense ? denseBytes : sparseBytes;

  const history = Array.isArray(store.examHistory) ? store.examHistory : [];
  const hasHistory = history.length > 0;
  const historyBytes = hasHistory ? encodeExamHistoryBytesV4(history) : [];

  const subjIdx = Math.max(0, SUBJECT_LIST.indexOf(store.lastSubject));
  const modeIdx = Math.max(0, MODE_LIST.indexOf(store.lastMode));
  const tierIdx = Math.max(0, TIER_LIST.indexOf(normalizeTier(store.lastTier)));
  const header0 = subjIdx & 0x07;
  const header1 =
    (modeIdx & 0x03) |
    ((tierIdx & 0x03) << 2) |
    ((useDense ? 1 : 0) << 4) |
    ((hasHistory ? 1 : 0) << 5);

  const payload: number[] = [header0, header1, ...questionBytes, ...historyBytes];
  const crc = computeCrc8(payload, payload.length);
  payload.push(crc);

  return `${CODE_PREFIX_V4}${encodeBase64Url(payload)}`;
}

function decodeSlotsBlock(
  body: Uint8Array,
  cursor: { pos: number },
  useDense: boolean,
  maxSlots: number
): Record<string, QuestionProgress> | null {
  const questions: Record<string, QuestionProgress> = {};

  if (!useDense) {
    const runCount = readVarint(body, cursor);
    if (runCount === null || runCount > maxSlots) return null;

    let prevEnd = 0;
    for (let r = 0; r < runCount; r++) {
      const delta = readVarint(body, cursor);
      if (delta === null || cursor.pos >= body.length) return null;
      const meta = body[cursor.pos++];
      const stateCode = (meta >> 5) & 0x07;
      let len = (meta & 0x0f) + 1;
      if ((meta & 0x10) !== 0) {
        if (cursor.pos >= body.length) return null;
        len = 17 + (((meta & 0x0f) << 8) | body[cursor.pos++]);
      }

      const start = prevEnd + delta;
      if (start + len > maxSlots) return null;
      const prog = stateCodeToProgress(stateCode);
      if (!prog) return null;

      for (let s = start; s < start + len; s++) {
        const qId = slotToQuestionId(s, maxSlots);
        if (qId) {
          questions[qId] = { ...prog };
        }
      }
      prevEnd = start + len;
    }
  } else {
    const slotCount = readVarint(body, cursor);
    if (slotCount === null || slotCount > maxSlots) return null;
    const bitBytesLen = Math.ceil((slotCount * 3) / 8);
    if (cursor.pos + bitBytesLen > body.length) return null;

    const packed = body.subarray(cursor.pos, cursor.pos + bitBytesLen);
    cursor.pos += bitBytesLen;

    for (let i = 0; i < slotCount; i++) {
      const bitPos = i * 3;
      const byteIdx = bitPos >> 3;
      const bitOff = bitPos & 7;
      let val = (packed[byteIdx] >> bitOff) & 0x07;
      if (bitOff > 5 && byteIdx + 1 < packed.length) {
        val |= (packed[byteIdx + 1] << (8 - bitOff)) & 0x07;
      }
      if (val === 0) continue;
      const prog = stateCodeToProgress(val);
      if (!prog) return null;
      const qId = slotToQuestionId(i, maxSlots);
      if (qId) {
        questions[qId] = prog;
      }
    }
  }

  return questions;
}

function decodeExamHistoryBlock(
  body: Uint8Array,
  cursor: { pos: number },
  parseMeta: (metaByte: number) => {
    subject: SubjectId;
    examType: 'standard' | 'mastered';
    breakdownCount: number;
  } | null
): ExamHistoryItem[] | null {
  if (cursor.pos >= body.length) return null;
  const histCount = body[cursor.pos++];
  if (histCount > 30) return null;

  const examHistory: ExamHistoryItem[] = [];
  for (let i = 0; i < histCount; i++) {
    if (cursor.pos >= body.length) return null;
    const metaParsed = parseMeta(body[cursor.pos++]);
    if (!metaParsed) return null;

    const tsSec = readVarint(body, cursor);
    const totalQuestions = readVarint(body, cursor);
    const correctCount = readVarint(body, cursor);
    const durationSeconds = readVarint(body, cursor);
    if (
      tsSec === null ||
      totalQuestions === null ||
      correctCount === null ||
      durationSeconds === null
    ) {
      return null;
    }

    const chapterBreakdown: Record<number, { correct: number; total: number }> = {};
    for (let c = 0; c < metaParsed.breakdownCount; c++) {
      if (cursor.pos >= body.length) return null;
      const ch = body[cursor.pos++];
      const chCorrect = readVarint(body, cursor);
      const chTotal = readVarint(body, cursor);
      if (chCorrect === null || chTotal === null) return null;
      chapterBreakdown[ch] = { correct: chCorrect, total: chTotal };
    }

    const timestamp = (tsSec + EPOCH_SEC_2025) * 1000;
    const scoreOn10 =
      totalQuestions > 0 ? Number(((correctCount / totalQuestions) * 10).toFixed(2)) : 0;

    examHistory.push({
      id: `sync-${tsSec}-${i}-${correctCount}-${totalQuestions}`,
      subject: metaParsed.subject,
      examType: metaParsed.examType,
      timestamp,
      totalQuestions,
      correctCount,
      scoreOn10,
      durationSeconds,
      chapterBreakdown,
    });
  }

  return examHistory;
}

function verifyBinaryEnvelope(encodedPart: string): Uint8Array | null {
  const bytes = decodeBase64Url(encodedPart);
  if (!bytes || bytes.length < 2) return null;

  const dataLen = bytes.length - 1;
  const expectedCrc = computeCrc8(bytes, dataLen);
  if (bytes[dataLen] !== expectedCrc) return null;

  return bytes.subarray(0, dataLen);
}

function importV3Code(encodedPart: string): UserProgressStore | null {
  const body = verifyBinaryEnvelope(encodedPart);
  if (!body) return null;

  const header = body[0];
  const subjIdx = header & 0x03;
  const lastSubject = SUBJECT_LIST[subjIdx];
  if (!lastSubject) return null;

  const lastMode: StudyMode = MODE_LIST[(header >> 2) & 0x03] ?? 'chapter';
  const lastTier: StudyTier = TIER_LIST[(header >> 4) & 0x03] ?? 'hardcore';
  const useDense = ((header >> 6) & 1) === 1;
  const hasHistory = ((header >> 7) & 1) === 1;

  const cursor = { pos: 1 };
  const questions = decodeSlotsBlock(body, cursor, useDense, MAX_SYNC_SLOTS_V3);
  if (!questions) return null;

  let examHistory: ExamHistoryItem[] = [];
  if (hasHistory) {
    const parsedHistory = decodeExamHistoryBlock(body, cursor, (metaByte) => {
      const sIdx = metaByte & 0x03;
      const subject = SUBJECT_LIST[sIdx];
      if (!subject) return null;
      return {
        subject,
        examType: (metaByte & 4) !== 0 ? 'mastered' : 'standard',
        breakdownCount: (metaByte >> 3) & 0x0f,
      };
    });
    if (!parsedHistory) return null;
    examHistory = parsedHistory;
  }

  if (cursor.pos !== body.length) return null;

  return {
    version: 1,
    questions,
    examHistory,
    lastSubject,
    lastMode,
    lastTier,
    subjectMigratedVnr: true,
    tierMigratedHardcore: true,
  };
}

function importV2Code(encodedPart: string): UserProgressStore | null {
  const body = verifyBinaryEnvelope(encodedPart);
  if (!body) return null;

  const header = body[0];
  if ((header & 0x80) !== 0) return null;

  const lastSubject: SubjectId = (header & 1) === 1 ? 'mln131' : 'vnr202';
  const lastMode: StudyMode = MODE_LIST[(header >> 1) & 0x03] ?? 'chapter';
  const lastTier: StudyTier = TIER_LIST[(header >> 3) & 0x03] ?? 'hardcore';
  const useDense = ((header >> 5) & 1) === 1;
  const hasHistory = ((header >> 6) & 1) === 1;

  const cursor = { pos: 1 };
  const questions = decodeSlotsBlock(body, cursor, useDense, MAX_SYNC_SLOTS_V2);
  if (!questions) return null;

  let examHistory: ExamHistoryItem[] = [];
  if (hasHistory) {
    const parsedHistory = decodeExamHistoryBlock(body, cursor, (metaByte) => ({
      subject: (metaByte & 1) === 1 ? 'mln131' : 'vnr202',
      examType: (metaByte & 2) !== 0 ? 'mastered' : 'standard',
      breakdownCount: (metaByte >> 2) & 0x0f,
    }));
    if (!parsedHistory) return null;
    examHistory = parsedHistory;
  }

  if (cursor.pos !== body.length) return null;

  return {
    version: 1,
    questions,
    examHistory,
    lastSubject,
    lastMode,
    lastTier,
    subjectMigratedVnr: true,
    tierMigratedHardcore: true,
  };
}

function importV1Code(rawCompressed: string): UserProgressStore | null {
  try {
    const jsonText = LZString.decompressFromEncodedURIComponent(rawCompressed);
    if (!jsonText) return null;

    const parsed = JSON.parse(jsonText) as Partial<CompactSyncPayload>;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.q)) {
      return null;
    }

    const questions: Record<string, QuestionProgress> = {};
    for (const row of parsed.q) {
      if (!Array.isArray(row) || typeof row[0] !== 'string') continue;
      const [id, streak, flaggedNum, lastResNum, correctCount, attemptCount, studiedNum] = row;
      questions[id] = {
        streak: typeof streak === 'number' ? Math.max(0, streak) : 0,
        flagged: flaggedNum === 1,
        ...(lastResNum === 1
          ? { lastResult: 'correct' as const }
          : lastResNum === 2
            ? { lastResult: 'wrong' as const }
            : {}),
        correctCount: typeof correctCount === 'number' ? Math.max(0, correctCount) : 0,
        attemptCount: typeof attemptCount === 'number' ? Math.max(0, attemptCount) : 0,
        studied: studiedNum === 1,
      };
    }

    return {
      version: 1,
      questions,
      examHistory: Array.isArray(parsed.h) ? parsed.h : [],
      lastSubject: normalizeSubject(parsed.s),
      lastMode:
        parsed.m === 'rolling' || parsed.m === 'flashcard' || parsed.m === 'exam'
          ? parsed.m
          : 'chapter',
      lastTier: normalizeTier(parsed.t),
      subjectMigratedVnr: true,
      tierMigratedHardcore: true,
    };
  } catch {
    return null;
  }
}

function importV4Code(encodedPart: string): UserProgressStore | null {
  const body = verifyBinaryEnvelope(encodedPart);
  if (!body || body.length < 2) return null;

  const subjIdx = body[0] & 0x07;
  const lastSubject = SUBJECT_LIST[subjIdx];
  if (!lastSubject) return null;

  const header1 = body[1];
  const lastMode: StudyMode = MODE_LIST[header1 & 0x03] ?? 'chapter';
  const lastTier: StudyTier = TIER_LIST[(header1 >> 2) & 0x03] ?? 'hardcore';
  const useDense = ((header1 >> 4) & 1) === 1;
  const hasHistory = ((header1 >> 5) & 1) === 1;

  const cursor = { pos: 2 };
  const questions = decodeSlotsBlock(body, cursor, useDense, MAX_SYNC_SLOTS_V4);
  if (!questions) return null;

  let examHistory: ExamHistoryItem[] = [];
  if (hasHistory) {
    const parsedHistory = decodeExamHistoryBlock(body, cursor, (metaByte) => {
      const sIdx = metaByte & 0x07;
      const subject = SUBJECT_LIST[sIdx];
      if (!subject) return null;
      return {
        subject,
        examType: (metaByte & 8) !== 0 ? 'mastered' : 'standard',
        breakdownCount: (metaByte >> 4) & 0x0f,
      };
    });
    if (!parsedHistory) return null;
    examHistory = parsedHistory;
  }

  if (cursor.pos !== body.length) return null;

  return {
    version: 1,
    questions,
    examHistory,
    lastSubject,
    lastMode,
    lastTier,
    subjectMigratedVnr: true,
    tierMigratedHardcore: true,
  };
}

export function importProgressCode(code: string): UserProgressStore | null {
  try {
    // Strip all whitespace/line breaks from copy/paste across mobile apps
    const cleaned = code.replace(/\s+/g, '');
    if (!cleaned) return null;

    const v4Match = /^ot4[:\-](.+)$/i.exec(cleaned);
    if (v4Match) {
      return importV4Code(v4Match[1]);
    }

    // Match OT3-, OT2-, or OT1: (case-insensitive to resist mobile auto-lowercase)
    const v3Match = /^ot3[:\-](.+)$/i.exec(cleaned);
    if (v3Match) {
      return importV3Code(v3Match[1]);
    }

    const v2Match = /^ot2[:\-](.+)$/i.exec(cleaned);
    if (v2Match) {
      return importV2Code(v2Match[1]);
    }

    // Backward compatible with OT1: or ot1: (e.g. iOS auto-lowercasing URL schemes)
    const v1Match = /^ot1[:\-](.+)$/i.exec(cleaned);
    if (v1Match) {
      return importV1Code(v1Match[1]);
    }

    // Raw LZString fallback without prefix
    return importV1Code(cleaned);
  } catch {
    return null;
  }
}

/**
 * Cumulatively merges an imported progress store into the current local store
 * so learning on multiple devices/tiers combines mastered & studied questions
 * and exam history without losing local progress.
 */
export function mergeProgressStores(
  current: UserProgressStore,
  incoming: UserProgressStore
): UserProgressStore {
  const mergedQuestions: Record<string, QuestionProgress> = { ...current.questions };

  for (const [qId, incProg] of Object.entries(incoming.questions)) {
    const curProg = mergedQuestions[qId];
    if (!curProg) {
      mergedQuestions[qId] = incProg;
      continue;
    }

    const curMastered = isMastered(curProg);
    const incMastered = isMastered(incProg);
    const eitherMastered = curMastered || incMastered;

    const streak = eitherMastered
      ? Math.max(2, curProg.streak || 0, incProg.streak || 0)
      : Math.max(curProg.streak || 0, incProg.streak || 0);
    const flagged = eitherMastered ? false : Boolean(curProg.flagged || incProg.flagged);
    const studied = Boolean(curProg.studied || incProg.studied || streak > 0);
    const correctCount = Math.max(curProg.correctCount || 0, incProg.correctCount || 0);
    const attemptCount = Math.max(curProg.attemptCount || 0, incProg.attemptCount || 0);
    const lastResult =
      streak > 0 || curProg.lastResult === 'correct' || incProg.lastResult === 'correct'
        ? ('correct' as const)
        : (incProg.lastResult ?? curProg.lastResult);

    mergedQuestions[qId] = {
      streak,
      flagged,
      studied,
      correctCount,
      attemptCount,
      ...(lastResult ? { lastResult } : {}),
    };
  }

  const historyMap = new Map<string, ExamHistoryItem>();
  const semanticKeys = new Set<string>();
  const makeSemanticKey = (item: ExamHistoryItem) =>
    `${item.subject}|${Math.floor(item.timestamp / 1000)}|${item.correctCount}|${item.totalQuestions}`;

  for (const item of current.examHistory) {
    historyMap.set(item.id, item);
    semanticKeys.add(makeSemanticKey(item));
  }
  for (const item of incoming.examHistory) {
    const semKey = makeSemanticKey(item);
    if (!historyMap.has(item.id) && !semanticKeys.has(semKey)) {
      historyMap.set(item.id, item);
      semanticKeys.add(semKey);
    }
  }
  const mergedHistory = Array.from(historyMap.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 30);

  return {
    version: 1,
    questions: mergedQuestions,
    examHistory: mergedHistory,
    lastSubject: current.lastSubject,
    lastMode: current.lastMode,
    lastTier: current.lastTier ?? 'hardcore',
    subjectMigratedVnr: true,
    tierMigratedHardcore: true,
  };
}
