import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Chuẩn hóa chuỗi văn bản câu hỏi / đáp án để so khớp khử trùng lặp chính xác
 * (bỏ khoảng trắng thừa, chữ thường, chuẩn hóa dấu câu, bỏ tiền tố "Question 1:", "Câu 1:")
 */
export function normalizeTextForMatch(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFC')
    .replace(/^(?:question|câu)\s*\d+\s*[:.-]?\s*/i, '')
    .replace(/\(choose\s+\d+\s+answers?\)/gi, '')
    .replace(/[\u2018\u2019\u201A\u201B`']/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F"]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^a-z0-9\u00C0-\u1EF9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tạo khóa vân tay (fingerprint) của 1 câu hỏi dựa trên:
 * - Nội dung câu hỏi đã chuẩn hóa
 * - Tập hợp nội dung các đáp án đã chuẩn hóa và sắp xếp A->Z (để dù đề khác đảo thứ tự A/B/C/D vẫn nhận ra là cùng 1 câu!)
 */
export function buildQuestionFingerprint(qText, options) {
  const normQ = normalizeTextForMatch(qText);
  const normOpts = (options || [])
    .map((o) => normalizeTextForMatch(o.text))
    .filter(Boolean)
    .sort()
    .join('|');
  return `${normQ}###${normOpts}`;
}

/**
 * Tầng 2: Gộp tất cả các file batch OCR của 1 môn (`tools/raw-exams/<subject>/ocr/*.json`),
 * khử trùng lặp thông minh (kể cả khi đáp án A/B/C/D bị đảo vị trí giữa các đề),
 * gộp danh sách tag đề (`exams` + `examAppearances`) và xuất ra `tools/raw-exams/<subject>/deduped.json`.
 */
function runDeduplicate(subjectId) {
  const subjectDir = path.join(__dirname, 'raw-exams', subjectId);
  const ocrDir = path.join(subjectDir, 'ocr');
  if (!fs.existsSync(ocrDir)) {
    throw new Error(`Chưa có thư mục OCR tại ${ocrDir}`);
  }

  const batchFiles = fs
    .readdirSync(ocrDir)
    .filter((f) => f.endsWith('.json'))
    .sort();

  const rawItems = [];
  for (const file of batchFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(ocrDir, file), 'utf8'));
    const list = Array.isArray(data) ? data : data.questions || [];
    for (const item of list) {
      rawItems.push(item);
    }
  }

  console.log(`[${subjectId.toUpperCase()}] Đã đọc ${rawItems.length} câu hỏi thô từ ${batchFiles.length} file batch OCR.`);

  // Map từ fingerprint -> canonical item
  const byFullFp = new Map();
  // Map dự phòng từ normQuestion -> mảng canonical items (khi câu hỏi giống hệt và >=75% đáp án giống hệt)
  const byQOnly = new Map();
  const dedupedList = [];

  for (const raw of rawItems) {
    const qText = (raw.question || '').trim();
    if (!qText) continue;

    const options = Array.isArray(raw.options)
      ? raw.options.map((o, idx) => ({
          key: String(o.key || String.fromCharCode(65 + idx)).trim().toUpperCase(),
          text: String(o.text || '').trim(),
        }))
      : [];

    const fullFp = buildQuestionFingerprint(qText, options);
    const normQ = normalizeTextForMatch(qText);

    let target = byFullFp.get(fullFp);

    // Nếu không khớp 100% cả câu hỏi + toàn bộ đáp án, kiểm tra xem câu hỏi có trùng khít và các đáp án khớp >= 75% không
    if (!target && normQ.length > 18 && byQOnly.has(normQ)) {
      const candidates = byQOnly.get(normQ);
      const rawOptSet = new Set(options.map((o) => normalizeTextForMatch(o.text)).filter(Boolean));
      for (const cand of candidates) {
        const candOptSet = new Set(
          cand.options.map((o) => normalizeTextForMatch(o.text)).filter(Boolean)
        );
        let overlap = 0;
        for (const t of rawOptSet) {
          if (candOptSet.has(t)) overlap++;
        }
        const minLen = Math.min(rawOptSet.size, candOptSet.size);
        if (minLen > 0 && overlap / minLen >= 0.75) {
          target = cand;
          break;
        }
      }
    }

    const examTag = raw.examTag || 'UNKNOWN';
    const order = Number(raw.order) || 0;
    const rawAns = Array.isArray(raw.rawAnswers)
      ? raw.rawAnswers.map((a) => String(a).trim().toUpperCase())
      : raw.rawAnswer
        ? [String(raw.rawAnswer).trim().toUpperCase()]
        : [];

    if (!target) {
      target = {
        tempId: `${subjectId}-u${String(dedupedList.length + 1).padStart(3, '0')}`,
        question: qText,
        options,
        isMultiSelect: Boolean(raw.isMultiSelect) || rawAns.length > 1,
        rawAnswersFromExams: [],
        exams: [],
        examAppearances: [],
      };
      byFullFp.set(fullFp, target);
      if (!byQOnly.has(normQ)) byQOnly.set(normQ, []);
      byQOnly.get(normQ).push(target);
      dedupedList.push(target);
    }

    if (!target.exams.includes(examTag)) {
      target.exams.push(examTag);
    }
    target.examAppearances.push({
      examTag,
      order,
      localFile: raw.localFile || '',
    });

    // Quy đổi đáp án thô của đề này sang đúng key (A/B/C/D) của bộ options chuẩn trong target (phòng trường hợp 2 đề đảo thứ tự đáp án!)
    const mappedAns = [];
    for (const ansKey of rawAns) {
      const srcOpt = options.find((o) => o.key === ansKey);
      if (srcOpt) {
        const srcNorm = normalizeTextForMatch(srcOpt.text);
        const destOpt = target.options.find((o) => normalizeTextForMatch(o.text) === srcNorm);
        mappedAns.push(destOpt ? destOpt.key : ansKey);
      } else {
        mappedAns.push(ansKey);
      }
    }

    if (mappedAns.length > 0) {
      target.rawAnswersFromExams.push({
        examTag,
        order,
        answers: mappedAns,
      });
    }
  }

  // Tổng hợp consensusAnswers từ các đề
  for (const item of dedupedList) {
    const counts = new Map();
    for (const entry of item.rawAnswersFromExams) {
      const sig = entry.answers.slice().sort().join(',');
      counts.set(sig, (counts.get(sig) || 0) + 1);
    }
    let bestSig = '';
    let bestCount = 0;
    for (const [sig, c] of counts.entries()) {
      if (c > bestCount) {
        bestCount = c;
        bestSig = sig;
      }
    }
    item.consensusAnswers = bestSig ? bestSig.split(',') : [];
    item.frequency = item.exams.length;
  }

  const outPath = path.join(subjectDir, 'deduped.json');
  fs.writeFileSync(outPath, JSON.stringify(dedupedList, null, 2), 'utf8');

  const multiAppear = dedupedList.filter((x) => x.frequency >= 2).length;
  console.log(
    `✓ [${subjectId.toUpperCase()}] Đã gộp ${rawItems.length} câu -> còn ${dedupedList.length} câu độc nhất (${multiAppear} câu xuất hiện từ 2 đề trở lên). Lưu tại ${outPath}`
  );
}

/**
 * Tầng 4: Gộp kết quả đã kiểm định đáp án + giải thích + chia chương từ `tools/raw-exams/<subject>/verified/*.json`
 * với `deduped.json`, kiểm tra chặt chẽ schema và xuất file `src/data/<subject>.json`.
 */
function runAssemble(subjectId, idPrefix) {
  const subjectDir = path.join(__dirname, 'raw-exams', subjectId);
  const dedupedPath = path.join(subjectDir, 'deduped.json');
  const verifiedDir = path.join(subjectDir, 'verified');

  if (!fs.existsSync(dedupedPath)) {
    throw new Error(`Chưa có file ${dedupedPath}`);
  }
  const deduped = JSON.parse(fs.readFileSync(dedupedPath, 'utf8'));
  const verifiedMap = new Map();

  if (fs.existsSync(verifiedDir)) {
    const files = fs
      .readdirSync(verifiedDir)
      .filter((f) => f.startsWith('v_') && f.endsWith('.json'))
      .sort();
    for (const f of files) {
      const data = JSON.parse(fs.readFileSync(path.join(verifiedDir, f), 'utf8'));
      const list = Array.isArray(data) ? data : data.questions || [];
      for (const v of list) {
        if (v.tempId) verifiedMap.set(v.tempId, v);
      }
    }
  }

  // Sắp xếp theo chapter tăng dần, sau đó theo frequency giảm dần, sau đó theo tempId
  const combined = deduped.map((item) => {
    const v = verifiedMap.get(item.tempId) || {};
    const validKeys = new Set(item.options.map((o) => o.key));
    let correctAnswers = Array.isArray(v.correctAnswers) && v.correctAnswers.length > 0
      ? v.correctAnswers.map((k) => String(k).trim().toUpperCase()).filter((k) => validKeys.has(k))
      : item.consensusAnswers.filter((k) => validKeys.has(k));

    if (correctAnswers.length === 0 && item.options.length > 0) {
      correctAnswers = [item.options[0].key];
    }

    const suspectedAnswers = Array.isArray(v.suspectedAnswers)
      ? v.suspectedAnswers
          .map((k) => String(k).trim().toUpperCase())
          .filter((k) => validKeys.has(k) && !correctAnswers.includes(k))
      : [];

    const chapter = Number(v.chapter) || 1;
    const chapterTitle = String(v.chapterTitle || `Chương ${chapter}`).trim();
    const explanation = String(v.explanation || '').trim();
    const note = String(v.note || '').trim();

    return {
      tempId: item.tempId,
      chapter,
      chapterTitle,
      question: String(v.question || item.question).trim(),
      options: item.options,
      correctAnswers,
      ...(suspectedAnswers.length > 0 ? { suspectedAnswers } : {}),
      isMultiSelect: Boolean(v.isMultiSelect ?? item.isMultiSelect) || correctAnswers.length > 1,
      explanation,
      note,
      exams: item.exams,
      examAppearances: item.examAppearances.map((a) => ({
        examTag: a.examTag,
        order: a.order,
      })),
    };
  });

  combined.sort((a, b) => a.chapter - b.chapter || b.exams.length - a.exams.length);

  const prefix = idPrefix || subjectId.replace(/[0-9]+.*$/, '');
  const finalQuestions = combined.map((q, idx) => {
    const id = `${prefix}-${String(idx + 1).padStart(3, '0')}`;
    const out = {
      id,
      chapter: q.chapter,
      chapterTitle: q.chapterTitle,
      question: q.question,
      options: q.options,
      correctAnswers: q.correctAnswers,
      ...(q.suspectedAnswers ? { suspectedAnswers: q.suspectedAnswers } : {}),
      isMultiSelect: q.isMultiSelect,
      explanation: q.explanation,
      note: q.note,
      exams: q.exams,
      examAppearances: q.examAppearances,
    };
    return out;
  });

  // Kiểm định chất lượng
  let missingExp = 0;
  const chapterCounts = {};
  for (const q of finalQuestions) {
    if (!q.explanation) missingExp++;
    chapterCounts[q.chapter] = (chapterCounts[q.chapter] || 0) + 1;
  }

  const outDataPath = path.join(__dirname, '..', 'src', 'data', `${subjectId}.json`);
  fs.writeFileSync(outDataPath, JSON.stringify(finalQuestions, null, 2), 'utf8');

  console.log(`✓ [${subjectId.toUpperCase()}] Đã xuất ${finalQuestions.length} câu chuẩn vào ${outDataPath}`);
  console.log(`  - Phân bố theo chương:`, chapterCounts);
  console.log(`  - Số câu thiếu giải thích: ${missingExp}`);
}

const [, , cmd, subjectArg, prefixArg] = process.argv;
if (cmd === 'dedup' && subjectArg) {
  runDeduplicate(subjectArg.toLowerCase());
} else if (cmd === 'assemble' && subjectArg) {
  runAssemble(subjectArg.toLowerCase(), prefixArg);
}
