import mln131Raw from './mln131.json';
import vnr202Raw from './vnr202.json';
import { QuestionItem, SubjectId } from '../types/quiz';

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
    chapters: buildChapters(mln131Questions),
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
    chapters: buildChapters(vnr202Questions),
  },
};

export function getQuestionsBySubject(subject: SubjectId): QuestionItem[] {
  return subject === 'mln131' ? mln131Questions : vnr202Questions;
}

export function getChaptersBySubject(subject: SubjectId): ChapterMeta[] {
  return SUBJECTS[subject].chapters;
}

export function isAnswerCorrect(selected: string[], correct: string[]): boolean {
  const normSelected = Array.from(new Set(selected.map(s => s.toUpperCase()))).sort();
  const normCorrect = Array.from(new Set(correct.map(c => c.toUpperCase()))).sort();
  if (normSelected.length !== normCorrect.length) return false;
  return normSelected.every((val, idx) => val === normCorrect[idx]);
}
