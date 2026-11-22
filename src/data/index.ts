import { QuestionItem, QuestionProgress, StudyTier, SubjectId } from '../types/quiz';

export interface ChapterMeta {
  chapter: number;
  title: string;
  count: number;
}

export interface ExamPaperMeta {
  code: string;
  label: string;
  questionCount: number;
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
  supportsLazyTiers?: boolean;
  chapterUnitLabel?: string;
  hasUnspecifiedChapterQuotas?: boolean;
  examPapers?: ExamPaperMeta[];
}

export interface SubjectLoadedBundle {
  subject: SubjectId;
  questionsByTier: Record<StudyTier, QuestionItem[]>;
  chaptersByTier: Record<StudyTier, ChapterMeta[]>;
}

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

const WDU203C_LAZY_MAX_IDS = new Set<string>([
  // Course 1 (22 câu trụ cột)
  'wdu-001', 'wdu-006', 'wdu-008', 'wdu-013', 'wdu-014', 'wdu-016', 'wdu-021', 'wdu-022',
  'wdu-023', 'wdu-024', 'wdu-025', 'wdu-026', 'wdu-027', 'wdu-028', 'wdu-031', 'wdu-032',
  'wdu-034', 'wdu-035', 'wdu-037', 'wdu-038', 'wdu-041', 'wdu-045',
  // Course 2 (17 câu trụ cột)
  'wdu-050', 'wdu-053', 'wdu-055', 'wdu-059', 'wdu-061', 'wdu-062', 'wdu-065', 'wdu-067',
  'wdu-068', 'wdu-070', 'wdu-075', 'wdu-078', 'wdu-083', 'wdu-084', 'wdu-092', 'wdu-093',
  'wdu-094',
  // Course 3 (14 câu trụ cột)
  'wdu-099', 'wdu-100', 'wdu-102', 'wdu-106', 'wdu-109', 'wdu-111', 'wdu-113', 'wdu-121',
  'wdu-123', 'wdu-126', 'wdu-127', 'wdu-132', 'wdu-133', 'wdu-134',
  // Course 4 (16 câu trụ cột)
  'wdu-144', 'wdu-152', 'wdu-155', 'wdu-160', 'wdu-162', 'wdu-164', 'wdu-168', 'wdu-170',
  'wdu-173', 'wdu-176', 'wdu-177', 'wdu-182', 'wdu-185', 'wdu-188', 'wdu-194', 'wdu-195',
  // Course 5 (7 câu trụ cột)
  'wdu-202', 'wdu-203', 'wdu-204', 'wdu-208', 'wdu-209', 'wdu-211', 'wdu-212',
  // Course 6 (26 câu trụ cột)
  'wdu-214', 'wdu-216', 'wdu-217', 'wdu-219', 'wdu-221', 'wdu-223', 'wdu-225', 'wdu-229',
  'wdu-231', 'wdu-232', 'wdu-236', 'wdu-238', 'wdu-244', 'wdu-245', 'wdu-246', 'wdu-249',
  'wdu-250', 'wdu-254', 'wdu-256', 'wdu-257', 'wdu-258', 'wdu-262', 'wdu-264', 'wdu-266',
  'wdu-272', 'wdu-274',
]);

const WDU203C_LAZY_EXTRA_IDS = [
  // Course 1 (+19 câu = 41 câu)
  'wdu-003', 'wdu-004', 'wdu-005', 'wdu-007', 'wdu-009', 'wdu-011', 'wdu-012', 'wdu-015',
  'wdu-018', 'wdu-020', 'wdu-029', 'wdu-030', 'wdu-039', 'wdu-040', 'wdu-042', 'wdu-044',
  'wdu-046', 'wdu-047', 'wdu-048',
  // Course 2 (+20 câu = 37 câu)
  'wdu-049', 'wdu-052', 'wdu-054', 'wdu-060', 'wdu-063', 'wdu-064', 'wdu-069', 'wdu-071',
  'wdu-073', 'wdu-074', 'wdu-076', 'wdu-077', 'wdu-079', 'wdu-080', 'wdu-081', 'wdu-085',
  'wdu-086', 'wdu-087', 'wdu-088', 'wdu-091',
  // Course 3 (+22 câu = 36 câu)
  'wdu-101', 'wdu-103', 'wdu-104', 'wdu-105', 'wdu-107', 'wdu-108', 'wdu-110', 'wdu-112',
  'wdu-114', 'wdu-115', 'wdu-116', 'wdu-118', 'wdu-119', 'wdu-120', 'wdu-122', 'wdu-124',
  'wdu-125', 'wdu-128', 'wdu-130', 'wdu-131', 'wdu-135', 'wdu-136',
  // Course 4 (+32 câu = 48 câu)
  'wdu-139', 'wdu-141', 'wdu-142', 'wdu-143', 'wdu-145', 'wdu-146', 'wdu-147', 'wdu-148',
  'wdu-150', 'wdu-151', 'wdu-153', 'wdu-154', 'wdu-157', 'wdu-158', 'wdu-159', 'wdu-161',
  'wdu-165', 'wdu-167', 'wdu-171', 'wdu-172', 'wdu-174', 'wdu-175', 'wdu-178', 'wdu-180',
  'wdu-181', 'wdu-183', 'wdu-184', 'wdu-186', 'wdu-187', 'wdu-190', 'wdu-197', 'wdu-198',
  // Course 5 (+5 câu = 12 câu)
  'wdu-199', 'wdu-205', 'wdu-207', 'wdu-210', 'wdu-213',
  // Course 6 (+29 câu = 55 câu)
  'wdu-215', 'wdu-218', 'wdu-220', 'wdu-224', 'wdu-226', 'wdu-227', 'wdu-228', 'wdu-230',
  'wdu-234', 'wdu-235', 'wdu-237', 'wdu-240', 'wdu-241', 'wdu-242', 'wdu-243', 'wdu-247',
  'wdu-248', 'wdu-251', 'wdu-252', 'wdu-259', 'wdu-260', 'wdu-261', 'wdu-263', 'wdu-265',
  'wdu-267', 'wdu-269', 'wdu-270', 'wdu-271', 'wdu-273',
];

const WDU203C_LAZY_IDS = new Set<string>([...WDU203C_LAZY_MAX_IDS, ...WDU203C_LAZY_EXTRA_IDS]);

const EMPTY_ID_SET = new Set<string>();

const LAZY_MAX_SETS: Record<SubjectId, Set<string>> = {
  mln131: MLN131_LAZY_MAX_IDS,
  vnr202: VNR202_LAZY_MAX_IDS,
  wdu203c: WDU203C_LAZY_MAX_IDS,
  mln122: EMPTY_ID_SET,
  wdu202c: EMPTY_ID_SET,
};

const LAZY_SETS: Record<SubjectId, Set<string>> = {
  mln131: MLN131_LAZY_IDS,
  vnr202: VNR202_LAZY_IDS,
  wdu203c: WDU203C_LAZY_IDS,
  mln122: EMPTY_ID_SET,
  wdu202c: EMPTY_ID_SET,
};

const SUBJECT_PREFIX_MAP: Record<SubjectId, { prefix: string; maxNum: number }> = {
  vnr202: { prefix: 'vnr-', maxNum: 404 },
  mln131: { prefix: 'mln-', maxNum: 432 },
  wdu203c: { prefix: 'wdu-', maxNum: 274 },
  mln122: { prefix: 'mln12-', maxNum: 396 },
  wdu202c: { prefix: 'wdu2-', maxNum: 145 },
};

export function subjectSupportsLazyTiers(subject: SubjectId): boolean {
  return SUBJECTS[subject].supportsLazyTiers !== false;
}

export function getEffectiveTier(subject: SubjectId, tier: StudyTier): StudyTier {
  return subjectSupportsLazyTiers(subject) ? tier : 'hardcore';
}

export function getQuestionsForExamPaper(
  questions: readonly QuestionItem[],
  examCode: string
): QuestionItem[] {
  return questions
    .filter((q) => q.exams?.includes(examCode))
    .slice()
    .sort((a, b) => {
      const idxA =
        a.examAppearances?.find((ap) => ap.examCode === examCode)?.questionIndex ?? 9999;
      const idxB =
        b.examAppearances?.find((ap) => ap.examCode === examCode)?.questionIndex ?? 9999;
      return idxA - idxB;
    });
}

export const SUBJECTS: Record<SubjectId, SubjectMeta> = {
  mln131: {
    id: 'mln131',
    code: 'MLN131',
    name: 'Chủ nghĩa xã hội khoa học',
    shortName: 'CNXH Khoa học',
    totalQuestions: 432,
    examTotal: 60,
    supportsLazyTiers: true,
    chapterUnitLabel: 'Chương',
    examQuotas: {
      1: 5,
      2: 5,
      3: 10,
      4: 10,
      5: 10,
      6: 10,
      7: 10,
    },
    chapters: [
      { chapter: 1, title: 'Nhập môn Chủ nghĩa xã hội khoa học', count: 48 },
      { chapter: 2, title: 'Sứ mệnh lịch sử của giai cấp công nhân', count: 57 },
      { chapter: 3, title: 'Chủ nghĩa xã hội và thời kỳ quá độ lên chủ nghĩa xã hội', count: 73 },
      { chapter: 4, title: 'Dân chủ xã hội chủ nghĩa và nhà nước xã hội chủ nghĩa', count: 62 },
      {
        chapter: 5,
        title: 'Cơ cấu xã hội - giai cấp và liên minh giai cấp, tầng lớp trong thời kỳ quá độ lên chủ nghĩa xã hội',
        count: 56,
      },
      { chapter: 6, title: 'Vấn đề dân tộc và tôn giáo trong thời kỳ quá độ lên chủ nghĩa xã hội', count: 71 },
      { chapter: 7, title: 'Vấn đề gia đình trong thời kỳ quá độ lên chủ nghĩa xã hội', count: 65 },
    ],
  },
  vnr202: {
    id: 'vnr202',
    code: 'VNR202',
    name: 'Lịch sử Đảng Cộng sản Việt Nam',
    shortName: 'Lịch sử Đảng',
    totalQuestions: 404,
    examTotal: 60,
    supportsLazyTiers: true,
    chapterUnitLabel: 'Chương',
    examQuotas: {
      1: 20,
      2: 20,
      3: 20,
    },
    chapters: [
      {
        chapter: 1,
        title: 'Đảng Cộng sản Việt Nam ra đời và lãnh đạo đấu tranh giành chính quyền (1930 - 1945)',
        count: 122,
      },
      {
        chapter: 2,
        title: 'Đảng lãnh đạo hai cuộc kháng chiến, hoàn thành giải phóng dân tộc, thống nhất đất nước (1945 - 1975)',
        count: 130,
      },
      {
        chapter: 3,
        title: 'Đảng lãnh đạo cả nước quá độ lên chủ nghĩa xã hội và tiến hành công cuộc đổi mới (1975 - nay)',
        count: 152,
      },
    ],
  },
  mln122: {
    id: 'mln122',
    code: 'MLN122',
    name: 'Kinh tế chính trị Mác - Lênin',
    shortName: 'Kinh tế chính trị',
    totalQuestions: 396,
    examTotal: 60,
    supportsLazyTiers: false,
    chapterUnitLabel: 'Chương',
    examQuotas: {
      1: 5,
      2: 10,
      3: 10,
      4: 10,
      5: 10,
      6: 15,
    },
    chapters: [
      {
        chapter: 1,
        title: 'Đối tượng, phương pháp nghiên cứu và chức năng của Kinh tế chính trị Mác - Lênin',
        count: 38,
      },
      {
        chapter: 2,
        title: 'Hàng hóa, thị trường và vai trò của các chủ thể tham gia thị trường',
        count: 83,
      },
      {
        chapter: 3,
        title: 'Giá trị thặng dư trong nền kinh tế thị trường',
        count: 87,
      },
      {
        chapter: 4,
        title: 'Cạnh tranh và độc quyền trong nền kinh tế thị trường',
        count: 72,
      },
      {
        chapter: 5,
        title: 'Kinh tế thị trường định hướng xã hội chủ nghĩa và các quan hệ lợi ích kinh tế ở Việt Nam',
        count: 60,
      },
      {
        chapter: 6,
        title: 'Công nghiệp hóa, hiện đại hóa và hội nhập kinh tế quốc tế của Việt Nam',
        count: 56,
      },
    ],
    examPapers: [
      { code: 'FA26-FE', label: 'Đề FA26 - FE', questionCount: 60 },
      { code: 'FA26-FE-RE', label: 'Đề FA26 - FE (Retake)', questionCount: 60 },
      { code: 'FA26-FE-C1', label: 'Đề FA26 - FE Ca 1', questionCount: 60 },
      { code: 'FA26-FE-C2', label: 'Đề FA26 - FE Ca 2', questionCount: 60 },
      { code: 'SU26-FE-C2', label: 'Đề SU26 - FE Ca 2', questionCount: 60 },
      { code: 'SP26-B5-FE', label: 'Đề SP26 Block 5 - FE', questionCount: 60 },
      { code: 'SP26-B5-FE-RE', label: 'Đề SP26 Block 5 - FE (Retake)', questionCount: 60 },
      { code: 'SP26-C1-FE', label: 'Đề SP26 - FE Ca 1', questionCount: 60 },
      { code: 'SP26-C2-FE', label: 'Đề SP26 - FE Ca 2', questionCount: 60 },
    ],
  },
  wdu202c: {
    id: 'wdu202c',
    code: 'WDU202c',
    name: 'UI/UX & Web Design Specialization',
    shortName: 'UI/UX & Web Design',
    totalQuestions: 145,
    examTotal: 50,
    supportsLazyTiers: false,
    chapterUnitLabel: 'MOOC',
    hasUnspecifiedChapterQuotas: true,
    examQuotas: {
      1: 21,
      2: 15,
      3: 10,
      4: 4,
    },
    chapters: [
      {
        chapter: 1,
        title: 'Visual Elements of User Interface Design',
        count: 62,
      },
      {
        chapter: 2,
        title: 'UX Design Fundamentals',
        count: 45,
      },
      {
        chapter: 3,
        title: 'Web Design: Strategy and Information Architecture',
        count: 31,
      },
      {
        chapter: 4,
        title: 'Web Design: Wireframes to Prototypes',
        count: 7,
      },
    ],
    examPapers: [
      { code: 'SU26-FE', label: 'Đề SU26 - FE', questionCount: 50 },
      { code: 'SU26-FE-RE', label: 'Đề SU26 - FE (Retake)', questionCount: 50 },
      { code: 'SP26-FE', label: 'Đề SP26 - FE', questionCount: 50 },
      { code: 'SP26-FE-RE', label: 'Đề SP26 - FE (Retake)', questionCount: 50 },
    ],
  },
  wdu203c: {
    id: 'wdu203c',
    code: 'WDU203c',
    name: 'UI/UX Design & User Research',
    shortName: 'UI/UX Design',
    totalQuestions: 274,
    examTotal: 60,
    supportsLazyTiers: true,
    chapterUnitLabel: 'MOOC',
    examQuotas: {
      1: 10,
      2: 11,
      3: 9,
      4: 13,
      5: 4,
      6: 13,
    },
    chapters: [
      { chapter: 1, title: 'Course 1: Introduction to UX Principles & Processes', count: 48 },
      { chapter: 2, title: 'Course 2: Understanding User Needs', count: 50 },
      { chapter: 3, title: 'Course 3: Evaluating Designs with Users', count: 40 },
      { chapter: 4, title: 'Course 4: UX Design: From Concept to Prototype', count: 60 },
      { chapter: 5, title: 'Course 5: UX Design Concept & Capstone Case Studies', count: 15 },
      { chapter: 6, title: 'Course 6: UX Research at Scale: Surveys, Analytics, Online Testing', count: 61 },
    ],
  },
};

function buildChapters(questions: QuestionItem[]): ChapterMeta[] {
  const map = new Map<number, ChapterMeta>();
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
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

const resolvedBundleCache = new Map<SubjectId, SubjectLoadedBundle>();
const inflightBundleCache = new Map<SubjectId, Promise<SubjectLoadedBundle>>();

function createSubjectBundle(subject: SubjectId, rawQuestions: QuestionItem[]): SubjectLoadedBundle {
  if (!subjectSupportsLazyTiers(subject)) {
    const hardcoreChapters = buildChapters(rawQuestions);
    return {
      subject,
      questionsByTier: {
        lazymax: rawQuestions,
        lazy: rawQuestions,
        hardcore: rawQuestions,
      },
      chaptersByTier: {
        lazymax: hardcoreChapters,
        lazy: hardcoreChapters,
        hardcore: hardcoreChapters,
      },
    };
  }
  const lazyMaxSet = LAZY_MAX_SETS[subject];
  const lazySet = LAZY_SETS[subject];
  const questionsByTier: Record<StudyTier, QuestionItem[]> = {
    lazymax: rawQuestions.filter((q) => lazyMaxSet.has(q.id)),
    lazy: rawQuestions.filter((q) => lazySet.has(q.id)),
    hardcore: rawQuestions,
  };
  const chaptersByTier: Record<StudyTier, ChapterMeta[]> = {
    lazymax: buildChapters(questionsByTier.lazymax),
    lazy: buildChapters(questionsByTier.lazy),
    hardcore: buildChapters(questionsByTier.hardcore),
  };
  return { subject, questionsByTier, chaptersByTier };
}

export function getCachedSubjectData(subject: SubjectId): SubjectLoadedBundle | null {
  return resolvedBundleCache.get(subject) ?? null;
}

export function loadSubjectData(subject: SubjectId): Promise<SubjectLoadedBundle> {
  const cached = resolvedBundleCache.get(subject);
  if (cached) return Promise.resolve(cached);

  const inflight = inflightBundleCache.get(subject);
  if (inflight) return inflight;

  const loader = (
    subject === 'mln131'
      ? import('./mln131.json')
      : subject === 'mln122'
        ? import('./mln122.json')
        : subject === 'wdu202c'
          ? import('./wdu202c.json')
          : subject === 'wdu203c'
            ? import('./wdu203c.json')
            : import('./vnr202.json')
  ).then((mod) => {
    const bundle = createSubjectBundle(subject, mod.default as QuestionItem[]);
    resolvedBundleCache.set(subject, bundle);
    inflightBundleCache.delete(subject);
    return bundle;
  }).catch((err) => {
    inflightBundleCache.delete(subject);
    throw err;
  });

  inflightBundleCache.set(subject, loader);
  return loader;
}

function parseValidSubjectQuestionNum(prefix: string, maxNum: number, id: string): number {
  if (!id.startsWith(prefix)) return -1;
  const num = Number.parseInt(id.slice(prefix.length), 10);
  if (!Number.isFinite(num) || num < 1 || num > maxNum) return -1;
  return id === `${prefix}${String(num).padStart(3, '0')}` ? num : -1;
}

export function getSubjectTotalCount(subject: SubjectId, tier: StudyTier = 'hardcore'): number {
  const effTier = getEffectiveTier(subject, tier);
  if (effTier === 'lazymax') return LAZY_MAX_SETS[subject].size;
  if (effTier === 'lazy') return LAZY_SETS[subject].size;
  return SUBJECTS[subject].totalQuestions;
}

export function isQuestionInSubjectTier(
  subject: SubjectId,
  tier: StudyTier,
  questionId: string
): boolean {
  const effTier = getEffectiveTier(subject, tier);
  if (effTier === 'lazymax') return LAZY_MAX_SETS[subject].has(questionId);
  if (effTier === 'lazy') return LAZY_SETS[subject].has(questionId);
  const spec = SUBJECT_PREFIX_MAP[subject];
  return parseValidSubjectQuestionNum(spec.prefix, spec.maxNum, questionId) > 0;
}

export function countSubjectMastered(
  subject: SubjectId,
  tier: StudyTier,
  questionsMap: Record<string, QuestionProgress>
): number {
  const effTier = getEffectiveTier(subject, tier);
  let count = 0;
  for (const [qId, qp] of Object.entries(questionsMap)) {
    if (!qp.flagged && qp.streak >= 2 && isQuestionInSubjectTier(subject, effTier, qId)) {
      count += 1;
    }
  }
  return count;
}

export function countCombinedProgressStats(
  questionsMap: Record<string, QuestionProgress>
): { mastered: number; hesitant: number } {
  let mastered = 0;
  let hesitant = 0;
  const specs = Object.values(SUBJECT_PREFIX_MAP);
  for (const [qId, qp] of Object.entries(questionsMap)) {
    const valid = specs.some((s) => parseValidSubjectQuestionNum(s.prefix, s.maxNum, qId) > 0);
    if (!valid) continue;
    if (qp.flagged) {
      hesitant += 1;
    } else if (qp.streak >= 2) {
      mastered += 1;
    }
  }
  return { mastered, hesitant };
}

export function isAnswerCorrect(selected: string[], correct: string[]): boolean {
  if (selected.length === 0 || correct.length === 0) return false;
  if (selected.length === 1 && correct.length === 1) {
    return selected[0].toUpperCase() === correct[0].toUpperCase();
  }
  const normSelected = Array.from(new Set(selected.map((s) => s.toUpperCase()))).sort();
  const normCorrect = Array.from(new Set(correct.map((c) => c.toUpperCase()))).sort();
  if (normSelected.length !== normCorrect.length) return false;
  return normSelected.every((val, idx) => val === normCorrect[idx]);
}
