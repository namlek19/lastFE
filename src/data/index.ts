import mln131Raw from './mln131.json';
import vnr202Raw from './vnr202.json';
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

const mln131Chapters = buildChapters(mln131Questions);
const vnr202ChaptersByTier: Record<StudyTier, ChapterMeta[]> = {
  lazymax: buildChapters(vnr202ByTier.lazymax),
  lazy: buildChapters(vnr202ByTier.lazy),
  hardcore: buildChapters(vnr202ByTier.hardcore),
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
    chapters: mln131Chapters,
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
};

  export function getQuestionsBySubject(
    subject: SubjectId,
    tier: StudyTier = 'hardcore'
  ): QuestionItem[] {
    return subject === 'mln131' ? mln131Questions : vnr202ByTier[tier];
  }

    export function getChaptersBySubject(
      subject: SubjectId,
      tier: StudyTier = 'hardcore'
    ): ChapterMeta[] {
      return subject === 'mln131' ? mln131Chapters : vnr202ChaptersByTier[tier];
    }

    export function isAnswerCorrect(selected: string[], correct: string[]): boolean {
      const normSelected = Array.from(new Set(selected.map(s => s.toUpperCase()))).sort();
      const normCorrect = Array.from(new Set(correct.map(c => c.toUpperCase()))).sort();
      if (normSelected.length !== normCorrect.length) return false;
      return normSelected.every((val, idx) => val === normCorrect[idx]);
    }
