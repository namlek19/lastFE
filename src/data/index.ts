import mln131Raw from './mln131.json';
import vnr202Raw from './vnr202.json';
import wdu203cRaw from './wdu203c.json';
import { QuestionItem, StudyTier, SubjectId } from '../types/quiz';

export interface ChapterMeta {
  chapter: number;
  title: string;
  count: number;
}

export interface SubjectMeta {
  id: SubjectId;
  code: string;
  name: string;
  shortName: string;
  totalQuestions: number;
  examTotal: number;
  examQuotas: Record<number, number>;
  chapters: ChapterMeta[];
}

const mln131Questions = mln131Raw as QuestionItem[];
const vnr202Questions = vnr202Raw as QuestionItem[];
const wdu203cQuestions = wdu203cRaw as QuestionItem[];

const MLN131_LAZY_MAX_IDS = new Set<string>([
  // Chương 1 (22 câu trụ cột)
  'mln-010', 'mln-039', 'mln-043', 'mln-044', 'mln-049', 'mln-054', 'mln-080', 'mln-103',
  'mln-118', 'mln-121', 'mln-129', 'mln-166', 'mln-170', 'mln-174', 'mln-179', 'mln-191',
  'mln-219', 'mln-235', 'mln-267', 'mln-296', 'mln-342', 'mln-386',
  // Chương 2 (20 câu trụ cột)
  'mln-005', 'mln-013', 'mln-023', 'mln-033', 'mln-092', 'mln-096', 'mln-112', 'mln-135',
  'mln-148', 'mln-177', 'mln-214', 'mln-215', 'mln-220', 'mln-248', 'mln-251', 'mln-286',
  'mln-355', 'mln-387', 'mln-419', 'mln-431',
  // Chương 3 (27 câu trụ cột)
  'mln-015', 'mln-036', 'mln-037', 'mln-068', 'mln-077', 'mln-078', 'mln-083', 'mln-084',
  'mln-091', 'mln-122', 'mln-125', 'mln-130', 'mln-167', 'mln-193', 'mln-194', 'mln-195',
  'mln-205', 'mln-217', 'mln-232', 'mln-243', 'mln-254', 'mln-258', 'mln-269', 'mln-289',
  'mln-304', 'mln-353', 'mln-413',
  // Chương 4 (22 câu trụ cột)
  'mln-018', 'mln-050', 'mln-060', 'mln-073', 'mln-086', 'mln-089', 'mln-124', 'mln-128',
  'mln-204', 'mln-206', 'mln-229', 'mln-234', 'mln-247', 'mln-249', 'mln-255', 'mln-263',
  'mln-281', 'mln-316', 'mln-320', 'mln-329', 'mln-380', 'mln-385',
  // Chương 5 (18 câu trụ cột)
  'mln-008', 'mln-075', 'mln-139', 'mln-155', 'mln-184', 'mln-189', 'mln-210', 'mln-213',
  'mln-244', 'mln-270', 'mln-293', 'mln-295', 'mln-312', 'mln-315', 'mln-321', 'mln-338',
  'mln-365', 'mln-425',
  // Chương 6 (24 câu trụ cột)
  'mln-001', 'mln-006', 'mln-007', 'mln-009', 'mln-011', 'mln-066', 'mln-087', 'mln-098',
  'mln-106', 'mln-108', 'mln-111', 'mln-141', 'mln-154', 'mln-156', 'mln-158', 'mln-161',
  'mln-253', 'mln-303', 'mln-322', 'mln-330', 'mln-378', 'mln-391', 'mln-407', 'mln-426',
  // Chương 7 (22 câu trụ cột)
  'mln-003', 'mln-016', 'mln-056', 'mln-093', 'mln-097', 'mln-100', 'mln-116', 'mln-142',
  'mln-159', 'mln-183', 'mln-260', 'mln-272', 'mln-277', 'mln-294', 'mln-317', 'mln-341',
  'mln-363', 'mln-372', 'mln-395', 'mln-404', 'mln-405', 'mln-411',
]);

const MLN131_LAZY_EXTRA_IDS = [
  // Chương 1 (+16 câu = 38 câu)
  'mln-030', 'mln-110', 'mln-117', 'mln-120', 'mln-168', 'mln-181', 'mln-187', 'mln-268',
  'mln-299', 'mln-331', 'mln-344', 'mln-351', 'mln-382', 'mln-398', 'mln-406', 'mln-408',
  // Chương 2 (+22 câu = 42 câu)
  'mln-029', 'mln-031', 'mln-081', 'mln-085', 'mln-115', 'mln-123', 'mln-132', 'mln-173',
  'mln-176', 'mln-178', 'mln-180', 'mln-202', 'mln-307', 'mln-314', 'mln-326', 'mln-334',
  'mln-335', 'mln-340', 'mln-343', 'mln-364', 'mln-412', 'mln-422',
  // Chương 3 (+28 câu = 55 câu)
  'mln-002', 'mln-021', 'mln-028', 'mln-032', 'mln-041', 'mln-079', 'mln-082', 'mln-113',
  'mln-131', 'mln-134', 'mln-137', 'mln-165', 'mln-182', 'mln-186', 'mln-190', 'mln-211',
  'mln-212', 'mln-225', 'mln-230', 'mln-284', 'mln-285', 'mln-302', 'mln-310', 'mln-313',
  'mln-324', 'mln-332', 'mln-374', 'mln-424',
  // Chương 4 (+22 câu = 44 câu)
  'mln-035', 'mln-064', 'mln-065', 'mln-105', 'mln-107', 'mln-126', 'mln-140', 'mln-157',
  'mln-160', 'mln-192', 'mln-198', 'mln-231', 'mln-257', 'mln-275', 'mln-291', 'mln-301',
  'mln-306', 'mln-318', 'mln-319', 'mln-350', 'mln-373', 'mln-421',
  // Chương 5 (+24 câu = 42 câu)
  'mln-012', 'mln-019', 'mln-022', 'mln-025', 'mln-059', 'mln-070', 'mln-072', 'mln-090',
  'mln-102', 'mln-127', 'mln-138', 'mln-188', 'mln-196', 'mln-199', 'mln-209', 'mln-218',
  'mln-223', 'mln-256', 'mln-265', 'mln-271', 'mln-288', 'mln-323', 'mln-336', 'mln-375',
  // Chương 6 (+37 câu = 61 câu)
  'mln-034', 'mln-046', 'mln-051', 'mln-055', 'mln-061', 'mln-076', 'mln-094', 'mln-119',
  'mln-143', 'mln-149', 'mln-162', 'mln-163', 'mln-169', 'mln-185', 'mln-208', 'mln-228',
  'mln-236', 'mln-246', 'mln-262', 'mln-273', 'mln-290', 'mln-292', 'mln-297', 'mln-308',
  'mln-327', 'mln-349', 'mln-354', 'mln-356', 'mln-367', 'mln-388', 'mln-393', 'mln-400',
  'mln-402', 'mln-410', 'mln-415', 'mln-423', 'mln-428',
  // Chương 7 (+29 câu = 51 câu)
  'mln-024', 'mln-026', 'mln-052', 'mln-062', 'mln-063', 'mln-071', 'mln-133', 'mln-147',
  'mln-153', 'mln-197', 'mln-221', 'mln-237', 'mln-241', 'mln-245', 'mln-266', 'mln-274',
  'mln-278', 'mln-279', 'mln-298', 'mln-309', 'mln-333', 'mln-339', 'mln-357', 'mln-369',
  'mln-389', 'mln-390', 'mln-396', 'mln-403', 'mln-420',
];

const MLN131_LAZY_IDS = new Set<string>([...MLN131_LAZY_MAX_IDS, ...MLN131_LAZY_EXTRA_IDS]);

const mln131ByTier: Record<StudyTier, QuestionItem[]> = {
  lazymax: mln131Questions.filter((q) => MLN131_LAZY_MAX_IDS.has(q.id)),
  lazy: mln131Questions.filter((q) => MLN131_LAZY_IDS.has(q.id)),
  hardcore: mln131Questions,
};

const VNR202_LAZY_MAX_IDS = new Set<string>([
  // Chương 1 (48 câu trụ cột)
  'vnr-033', 'vnr-036', 'vnr-037', 'vnr-038', 'vnr-057', 'vnr-059', 'vnr-060', 'vnr-061',
  'vnr-093', 'vnr-094', 'vnr-113', 'vnr-114', 'vnr-115', 'vnr-116', 'vnr-117', 'vnr-118',
  'vnr-119', 'vnr-120', 'vnr-145', 'vnr-148', 'vnr-149', 'vnr-157', 'vnr-159', 'vnr-160',
  'vnr-161', 'vnr-193', 'vnr-194', 'vnr-200', 'vnr-203', 'vnr-237', 'vnr-252', 'vnr-255',
  'vnr-257', 'vnr-278', 'vnr-279', 'vnr-291', 'vnr-310', 'vnr-311', 'vnr-334', 'vnr-335',
  'vnr-338', 'vnr-344', 'vnr-347', 'vnr-354', 'vnr-363', 'vnr-374', 'vnr-383', 'vnr-393',
  // Chương 2 (40 câu trụ cột)
  'vnr-001', 'vnr-003', 'vnr-006', 'vnr-007', 'vnr-009', 'vnr-023', 'vnr-024', 'vnr-026',
  'vnr-028', 'vnr-030', 'vnr-031', 'vnr-070', 'vnr-071', 'vnr-082', 'vnr-084', 'vnr-088',
  'vnr-089', 'vnr-109', 'vnr-125', 'vnr-140', 'vnr-142', 'vnr-153', 'vnr-154', 'vnr-172',
  'vnr-173', 'vnr-183', 'vnr-184', 'vnr-201', 'vnr-205', 'vnr-243', 'vnr-260', 'vnr-276',
  'vnr-283', 'vnr-289', 'vnr-302', 'vnr-322', 'vnr-327', 'vnr-350', 'vnr-378', 'vnr-396',
  // Chương 3 (54 câu trụ cột)
  'vnr-012', 'vnr-014', 'vnr-015', 'vnr-016', 'vnr-017', 'vnr-018', 'vnr-020', 'vnr-021',
  'vnr-042', 'vnr-043', 'vnr-045', 'vnr-046', 'vnr-050', 'vnr-072', 'vnr-077', 'vnr-079',
  'vnr-080', 'vnr-098', 'vnr-099', 'vnr-101', 'vnr-121', 'vnr-132', 'vnr-133', 'vnr-136',
  'vnr-152', 'vnr-155', 'vnr-178', 'vnr-179', 'vnr-180', 'vnr-189', 'vnr-214', 'vnr-215',
  'vnr-218', 'vnr-231', 'vnr-245', 'vnr-246', 'vnr-256', 'vnr-287', 'vnr-301', 'vnr-305',
  'vnr-328', 'vnr-330', 'vnr-336', 'vnr-342', 'vnr-356', 'vnr-379', 'vnr-381', 'vnr-382',
  'vnr-386', 'vnr-387', 'vnr-395', 'vnr-397', 'vnr-399', 'vnr-400',
]);

const VNR202_LAZY_EXTRA_IDS = [
  // Chương 1 (+33 câu = 81 câu)
  'vnr-032', 'vnr-034', 'vnr-035', 'vnr-049', 'vnr-051', 'vnr-054', 'vnr-092', 'vnr-095',
  'vnr-096', 'vnr-097', 'vnr-144', 'vnr-146', 'vnr-147', 'vnr-158', 'vnr-196', 'vnr-198',
  'vnr-206', 'vnr-209', 'vnr-229', 'vnr-234', 'vnr-239', 'vnr-240', 'vnr-265', 'vnr-266',
  'vnr-275', 'vnr-282', 'vnr-284', 'vnr-303', 'vnr-304', 'vnr-318', 'vnr-340', 'vnr-360',
  'vnr-364',
  // Chương 2 (+45 câu = 85 câu)
  'vnr-002', 'vnr-004', 'vnr-005', 'vnr-008', 'vnr-010', 'vnr-011', 'vnr-025', 'vnr-027',
  'vnr-029', 'vnr-053', 'vnr-062', 'vnr-063', 'vnr-067', 'vnr-081', 'vnr-083', 'vnr-085',
  'vnr-090', 'vnr-111', 'vnr-127', 'vnr-138', 'vnr-139', 'vnr-143', 'vnr-164', 'vnr-169',
  'vnr-170', 'vnr-171', 'vnr-195', 'vnr-204', 'vnr-208', 'vnr-223', 'vnr-236', 'vnr-249',
  'vnr-254', 'vnr-263', 'vnr-272', 'vnr-298', 'vnr-306', 'vnr-308', 'vnr-313', 'vnr-316',
  'vnr-321', 'vnr-325', 'vnr-352', 'vnr-367', 'vnr-390',
  // Chương 3 (+62 câu = 116 câu)
  'vnr-013', 'vnr-039', 'vnr-040', 'vnr-044', 'vnr-047', 'vnr-048', 'vnr-052', 'vnr-073',
  'vnr-074', 'vnr-076', 'vnr-078', 'vnr-103', 'vnr-105', 'vnr-112', 'vnr-129', 'vnr-130',
  'vnr-134', 'vnr-135', 'vnr-151', 'vnr-156', 'vnr-174', 'vnr-175', 'vnr-187', 'vnr-190',
  'vnr-212', 'vnr-213', 'vnr-217', 'vnr-219', 'vnr-226', 'vnr-227', 'vnr-242', 'vnr-247',
  'vnr-248', 'vnr-262', 'vnr-271', 'vnr-273', 'vnr-274', 'vnr-285', 'vnr-286', 'vnr-290',
  'vnr-295', 'vnr-307', 'vnr-320', 'vnr-331', 'vnr-343', 'vnr-345', 'vnr-348', 'vnr-353',
  'vnr-358', 'vnr-361', 'vnr-362', 'vnr-365', 'vnr-366', 'vnr-368', 'vnr-369', 'vnr-380',
  'vnr-388', 'vnr-391', 'vnr-392', 'vnr-394', 'vnr-398', 'vnr-401',
];

const VNR202_LAZY_IDS = new Set<string>([...VNR202_LAZY_MAX_IDS, ...VNR202_LAZY_EXTRA_IDS]);

const vnr202ByTier: Record<StudyTier, QuestionItem[]> = {
  lazymax: vnr202Questions.filter((q) => VNR202_LAZY_MAX_IDS.has(q.id)),
  lazy: vnr202Questions.filter((q) => VNR202_LAZY_IDS.has(q.id)),
  hardcore: vnr202Questions,
};

// WDU203c tạm dùng full source (274 câu) cho cả 3 mức cho tới khi tách LAZY / LAZY MAX
const wdu203cByTier: Record<StudyTier, QuestionItem[]> = {
  lazymax: wdu203cQuestions,
  lazy: wdu203cQuestions,
  hardcore: wdu203cQuestions,
};

function buildChapters(questions: QuestionItem[]): ChapterMeta[] {
  const map = new Map<number, ChapterMeta>();
  for (const q of questions) {
    const existing = map.get(q.chapter);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(q.chapter, {
        chapter: q.chapter,
        title: q.chapterTitle,
        count: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.chapter - b.chapter);
}

const mln131ChaptersByTier: Record<StudyTier, ChapterMeta[]> = {
  lazymax: buildChapters(mln131ByTier.lazymax),
  lazy: buildChapters(mln131ByTier.lazy),
  hardcore: buildChapters(mln131ByTier.hardcore),
};
const vnr202ChaptersByTier: Record<StudyTier, ChapterMeta[]> = {
  lazymax: buildChapters(vnr202ByTier.lazymax),
  lazy: buildChapters(vnr202ByTier.lazy),
  hardcore: buildChapters(vnr202ByTier.hardcore),
};
const wdu203cChaptersByTier: Record<StudyTier, ChapterMeta[]> = {
  lazymax: buildChapters(wdu203cByTier.lazymax),
  lazy: buildChapters(wdu203cByTier.lazy),
  hardcore: buildChapters(wdu203cByTier.hardcore),
};

const QUESTIONS_BY_SUBJECT: Record<SubjectId, Record<StudyTier, QuestionItem[]>> = {
  mln131: mln131ByTier,
  vnr202: vnr202ByTier,
  wdu203c: wdu203cByTier,
};

const CHAPTERS_BY_SUBJECT: Record<SubjectId, Record<StudyTier, ChapterMeta[]>> = {
  mln131: mln131ChaptersByTier,
  vnr202: vnr202ChaptersByTier,
  wdu203c: wdu203cChaptersByTier,
};

export const SUBJECTS: Record<SubjectId, SubjectMeta> = {
  mln131: {
    id: 'mln131',
    code: 'MLN131',
    name: 'Chủ nghĩa xã hội khoa học',
    shortName: 'CNXH Khoa học',
    totalQuestions: mln131Questions.length,
    examTotal: 60,
    examQuotas: {
      1: 5,
      2: 5,
      3: 10,
      4: 10,
      5: 10,
      6: 10,
      7: 10,
    },
    chapters: mln131ChaptersByTier.hardcore,
  },
  vnr202: {
    id: 'vnr202',
    code: 'VNR202',
    name: 'Lịch sử Đảng Cộng sản Việt Nam',
    shortName: 'Lịch sử Đảng',
    totalQuestions: vnr202Questions.length,
    examTotal: 60,
    examQuotas: {
      1: 20,
      2: 20,
      3: 20,
    },
    chapters: vnr202ChaptersByTier.hardcore,
  },
  wdu203c: {
    id: 'wdu203c',
    code: 'WDU203c',
    name: 'UI/UX Design & User Research',
    shortName: 'UI/UX Design',
    totalQuestions: wdu203cQuestions.length,
    examTotal: 60,
    examQuotas: {
      1: 10,
      2: 11,
      3: 9,
      4: 13,
      5: 4,
      6: 13,
    },
    chapters: wdu203cChaptersByTier.hardcore,
  },
};

export function getQuestionsBySubject(
  subject: SubjectId,
  tier: StudyTier = 'hardcore'
): QuestionItem[] {
  return QUESTIONS_BY_SUBJECT[subject][tier];
}

export function getChaptersBySubject(
  subject: SubjectId,
  tier: StudyTier = 'hardcore'
): ChapterMeta[] {
  return CHAPTERS_BY_SUBJECT[subject][tier];
}

export function isAnswerCorrect(selected: string[], correct: string[]): boolean {
  const normSelected = Array.from(new Set(selected.map((s) => s.toUpperCase()))).sort();
  const normCorrect = Array.from(new Set(correct.map((c) => c.toUpperCase()))).sort();
  if (normSelected.length !== normCorrect.length) return false;
  return normSelected.every((val, idx) => val === normCorrect[idx]);
}
