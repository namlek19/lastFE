import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Info, X } from 'lucide-react';
import { StudyTier, SubjectId } from '../types/quiz';
import { SakugaMangaTag } from './SakugaVfx';

interface PredictionRow {
  method: string;
  avg: string;
  range: string;
  p5: string;
  p7: string;
  p8: string;
  p9: string;
  featured?: boolean;
}

interface TierPredictionSpec {
  tier: 'lazymax' | 'lazy';
  label: string;
  tone: 'emerald' | 'amber';
  countText: string;
  rows: readonly PredictionRow[];
}

interface SubjectPredictionSpec {
  code: string;
  examRule: string;
  totalQuestions: number;
  tiers: readonly TierPredictionSpec[];
}

const TIER_SCORE_PREDICTIONS: Record<SubjectId, SubjectPredictionSpec> = {
  vnr202: {
    code: 'VNR202',
    examRule: '20-20-20',
    totalQuestions: 404,
    tiers: [
      {
        tier: 'lazymax',
        label: 'LAZY MAX',
        tone: 'emerald',
        countText: '142 / 404 câu',
        rows: [
          { method: 'Học vẹt', avg: '6.23', range: '5.50–7.00', p5: '98.3%', p7: '13.1%', p8: '0.2%', p9: '0%' },
          { method: 'Kỹ giải thích', avg: '8.51', range: '7.83–9.00', p5: '100%', p7: '99.9%', p8: '89.9%', p9: '18.5%', featured: true },
          { method: 'Hiểu sâu', avg: '9.09', range: '8.67–9.50', p5: '100%', p7: '100%', p8: '99.8%', p9: '69.7%' },
        ],
      },
      {
        tier: 'lazy',
        label: 'LAZY',
        tone: 'amber',
        countText: '282 / 404 câu',
        rows: [
          { method: 'Học vẹt', avg: '7.93', range: '7.33–8.50', p5: '100%', p7: '97.2%', p8: '51.7%', p9: '2.1%' },
          { method: 'Kỹ giải thích', avg: '9.48', range: '9.17–9.83', p5: '100%', p7: '100%', p8: '100%', p9: '96.4%', featured: true },
          { method: 'Hiểu sâu', avg: '9.74', range: '9.50–10.0', p5: '100%', p7: '100%', p8: '100%', p9: '99.9%' },
        ],
      },
    ],
  },
  mln131: {
    code: 'MLN131',
    examRule: '5-5-10×5',
    totalQuestions: 432,
    tiers: [
      {
        tier: 'lazymax',
        label: 'LAZY MAX',
        tone: 'emerald',
        countText: '155 / 432 câu',
        rows: [
          { method: 'Học vẹt', avg: '6.25', range: '5.50–7.00', p5: '98.3%', p7: '14.0%', p8: '0.3%', p9: '0%' },
          { method: 'Kỹ giải thích', avg: '8.62', range: '8.00–9.17', p5: '100%', p7: '100%', p8: '93.8%', p9: '25.6%', featured: true },
          { method: 'Hiểu sâu', avg: '9.27', range: '8.83–9.67', p5: '100%', p7: '100%', p8: '100%', p9: '85.7%' },
        ],
      },
      {
        tier: 'lazy',
        label: 'LAZY',
        tone: 'amber',
        countText: '333 / 432 câu',
        rows: [
          { method: 'Học vẹt', avg: '8.20', range: '7.50–8.83', p5: '100%', p7: '99.3%', p8: '72.4%', p9: '6.3%' },
          { method: 'Kỹ giải thích', avg: '9.51', range: '9.17–9.83', p5: '100%', p7: '100%', p8: '100%', p9: '97.2%', featured: true },
          { method: 'Hiểu sâu', avg: '9.75', range: '9.50–10.0', p5: '100%', p7: '100%', p8: '100%', p9: '99.9%' },
        ],
      },
    ],
  },
  wdu203c: {
    code: 'WDU203c',
    examRule: '10-11-9-13-4-13',
    totalQuestions: 274,
    tiers: [
      {
        tier: 'lazymax',
        label: 'LAZY MAX',
        tone: 'emerald',
        countText: '102 / 274 câu',
        rows: [
          { method: 'Học vẹt', avg: '6.17', range: '5.33–7.00', p5: '97.7%', p7: '10.8%', p8: '0.2%', p9: '0%' },
          { method: 'Kỹ giải thích', avg: '8.32', range: '7.67–8.83', p5: '100%', p7: '99.7%', p8: '80.5%', p9: '10.0%', featured: true },
          { method: 'Hiểu sâu', avg: '9.00', range: '8.50–9.50', p5: '100%', p7: '100%', p8: '99.6%', p9: '60.0%' },
        ],
      },
      {
        tier: 'lazy',
        label: 'LAZY',
        tone: 'amber',
        countText: '229 / 274 câu',
        rows: [
          { method: 'Học vẹt', avg: '8.42', range: '7.83–9.00', p5: '100%', p7: '99.8%', p8: '86.0%', p9: '14.2%' },
          { method: 'Kỹ giải thích', avg: '9.54', range: '9.17–9.83', p5: '100%', p7: '100%', p8: '100%', p9: '97.9%', featured: true },
          { method: 'Hiểu sâu', avg: '9.77', range: '9.50–10.0', p5: '100%', p7: '100%', p8: '100%', p9: '100%' },
        ],
      },
    ],
  },
};

const QUICK_PICK_GUIDE: readonly {
  tier: StudyTier;
  label: string;
  tone: 'emerald' | 'amber' | 'rose';
  shortNote: string;
}[] = [
  {
    tier: 'lazymax',
    label: 'LAZY MAX',
    tone: 'emerald',
    shortNote: 'Gấp thời gian · Đọc giải thích ~8.5–9.3',
  },
  {
    tier: 'lazy',
    label: 'LAZY',
    tone: 'amber',
    shortNote: 'Muốn chắc 8–9+ · Ít rủi ro',
  },
  {
    tier: 'hardcore',
    label: 'HARDCORE',
    tone: 'rose',
    shortNote: 'Full đề · Chắc ăn 100%',
  },
];

function getPctToneClass(value: string): string {
  const num = parseFloat(value);
  if (Number.isNaN(num)) return 'text-[#656058] dark:text-[#9CA39B]';
  if (num >= 90) return 'font-bold text-[#047857] dark:text-[#34D399]';
  if (num >= 50) return 'font-semibold text-[#B45309] dark:text-[#FBBF24]';
  if (num < 20) return 'font-medium text-[#BE123C] dark:text-[#FDA4AF]';
  return 'font-medium text-[#292524] dark:text-[#E7E5E4]';
}

export interface TierInfoModalProps {
  isOpen: boolean;
  tier: StudyTier;
  subject: SubjectId;
  onSelectTier: (tier: StudyTier) => void;
  onClose: () => void;
}

export const TierInfoModal: React.FC<TierInfoModalProps> = ({
  isOpen,
  tier,
  subject,
  onSelectTier,
  onClose,
}) => {
  const safeSubject: SubjectId = subject === 'mln131' ? 'mln131' : 'vnr202';
  const [previewSubject, setPreviewSubject] = useState<SubjectId>(safeSubject);

  useEffect(() => {
    if (isOpen) {
      setPreviewSubject(safeSubject);
    }
  }, [isOpen, safeSubject]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (typeof document === 'undefined') return null;

  const activePred = TIER_SCORE_PREDICTIONS[previewSubject];

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="tier-info-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#18181B]/60 p-3 dark:bg-[#0F100E]/82 sm:p-6"
        >
          <motion.div
            key="tier-info-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Lời nhắn từ Nam về 3 mức học"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border-2 border-[#27272A] bg-[#EAE6DD] shadow-[5px_5px_0_0_#C7D2FE,0_16px_38px_-8px_rgba(24,24,27,0.18)] dark:border-[#52525B] dark:bg-[#161816] dark:shadow-[5px_5px_0_0_#312E81,0_18px_42px_-8px_rgba(0,0,0,0.85)]"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[#D5CFC2] px-4 py-3 dark:border-[#262925] sm:px-5 sm:py-3.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#A5B4FC] bg-[#EEF2FF] text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/40 dark:text-[#A5B4FC]">
                  <Info className="h-4 w-4" />
                </span>
                <span className="inline-flex items-center rounded-full border border-[#A5B4FC] bg-[#EEF2FF] px-2.5 py-0.5 text-xs font-bold text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/35 dark:text-[#A5B4FC]">
                  from Namblee
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng hộp thoại"
                className="cursor-pointer rounded-xl p-1.5 text-[#656058] transition hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:text-[#9CA39B] dark:hover:bg-[#312E81]/30 dark:hover:text-[#A5B4FC]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-3.5 text-[13px] leading-relaxed text-[#292524] dark:text-[#E7E5E4] sm:p-5 sm:text-sm">
              {/* Top Row: Nam's Message + Roadmap & Quick Picker */}
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-12">
                {/* Left Column: Nam's Original Note */}
                <div className="space-y-2.5 rounded-xl border border-[#C6BEB0] bg-[#FFFFFF] p-3.5 dark:border-[#323833] dark:bg-[#1E221F] md:col-span-7">
                  <p className="font-medium text-[#18181B] dark:text-[#F5F5F4]">
                    Hi, Nam đây, t dựa vào 1 vài sách về tư duy và trí nhớ não bộ để rút gọn lại số câu phải học.
                  </p>

                  <p className="leading-[2.05]">
                    Thì giờ có 3 mức:{' '}
                    <SakugaMangaTag
                      label="HARDCORE"
                      tone="rose"
                      animateBurst={false}
                      className="mx-0.5 align-middle"
                    />{' '}
                    là full source,{' '}
                    <SakugaMangaTag
                      label="LAZY"
                      tone="amber"
                      animateBurst={false}
                      className="mx-0.5 align-middle"
                    />{' '}
                    là giảm bớt đi chút,{' '}
                    <SakugaMangaTag
                      label="LAZY MAX"
                      tone="emerald"
                      animateBurst={false}
                      className="mx-0.5 align-middle"
                    />{' '}
                    là giảm vãi nồi.
                  </p>

                  <p className="leading-[2]">
                    Nếu ít thời gian thì có thể học theo kiểu{' '}
                    <strong className="font-bold text-[#047857] dark:text-[#34D399]">
                      HỌC HIỂU
                    </strong>{' '}
                    <SakugaMangaTag
                      label="LAZY MAX"
                      tone="emerald"
                      animateBurst={false}
                      className="mx-0.5 align-middle"
                    />{' '}
                    vì nó đã bao gồm các ý chính rồi chỉ cần suy luận là có thể ra đáp án của tất cả các câu còn lại, vẫn khuyến khích nên học full.
                  </p>
                </div>

                {/* Right Column: Roadmap + Compact Quick Pick */}
                <div className="flex flex-col gap-3 md:col-span-5">
                  <div className="rounded-xl border border-[#C6BEB0] bg-[#FFFFFF] p-3 dark:border-[#323833] dark:bg-[#1E221F]">
                    <p className="mb-2 text-center text-xs font-semibold text-[#18181B] dark:text-[#F5F5F4] sm:text-[13px]">
                      Nói chung học theo kiểu này:
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                      <SakugaMangaTag label="LAZY MAX" tone="emerald" animateBurst={false} />
                      <span className="text-xs font-black text-[#656058] dark:text-[#9CA39B]">
                        -&gt;
                      </span>
                      <SakugaMangaTag label="LAZY" tone="amber" animateBurst={false} />
                      <span className="text-xs font-black text-[#656058] dark:text-[#9CA39B]">
                        -&gt;
                      </span>
                      <SakugaMangaTag label="HARDCORE" tone="rose" animateBurst={false} />
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col justify-between rounded-xl border border-[#C6BEB0] bg-[#FFFFFF] p-3 dark:border-[#323833] dark:bg-[#1E221F]">
                    <p className="mb-2 text-[11px] font-bold tracking-wide text-[#656058] uppercase dark:text-[#9CA39B]">
                      Chọn nhanh theo mục tiêu
                    </p>
                    <div className="space-y-1.5">
                      {QUICK_PICK_GUIDE.map((item) => {
                        const isCurrent = tier === item.tier;
                        return (
                          <button
                            key={item.tier}
                            type="button"
                            onClick={() => {
                              onSelectTier(item.tier);
                              onClose();
                            }}
                            className={`sakuga-btn flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${
                              isCurrent
                                ? 'border-[#4338CA] bg-[#EEF2FF] dark:border-[#818CF8] dark:bg-[#312E81]/35'
                                : 'border-[#D5CFC2] bg-[#FAF9F5] hover:border-[#4338CA] hover:bg-[#EEF2FF] dark:border-[#2C302B] dark:bg-[#161816] dark:hover:border-[#818CF8]'
                            }`}
                          >
                            <SakugaMangaTag
                              label={item.label}
                              tone={item.tone}
                              animateBurst={false}
                              className="shrink-0"
                            />
                            <span className="text-right text-[11.5px] font-semibold text-[#292524] dark:text-[#E7E5E4]">
                              {item.shortNote}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Section: Compact Score Prediction Breakdown (VNR202 & MLN131) */}
              <div className="space-y-3 rounded-xl border border-[#C6BEB0] bg-[#FAF9F5] p-3 dark:border-[#323833] dark:bg-[#1A1D1A] sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-xs font-extrabold tracking-tight text-[#18181B] dark:text-[#F5F5F4] sm:text-sm">
                      Dự đoán điểm thi (đề 60 câu · {activePred.examRule})
                    </h3>
                    <p className="text-[11px] text-[#656058] dark:text-[#9CA39B]">
                      Đọc{' '}
                      <span className="font-bold text-[#047857] dark:text-[#34D399]">
                        kỹ giải thích
                      </span>{' '}
                      (mức 2) kéo điểm từ ~6.2 lên ~8.5–9.5
                    </p>
                  </div>

                  {/* Subject Switcher Pills */}
                  <div
                    role="tablist"
                    aria-label="Chọn môn xem dự đoán điểm"
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl border-2 border-[#C6BEB0] bg-[#EAE6DD] p-0.5 dark:border-[#2C302B] dark:bg-[#0F100E]"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={previewSubject === 'vnr202'}
                      onClick={() => setPreviewSubject('vnr202')}
                      className={`inline-flex -skew-x-12 cursor-pointer items-center rounded-md border-2 px-2.5 py-0.5 text-[11px] font-black italic tracking-wider transition ${
                        previewSubject === 'vnr202'
                          ? 'border-[#7C2D12] bg-[#EA580C] text-white shadow-[2px_2px_0_0_#FDBA74] dark:border-[#FDBA74]'
                          : 'border-transparent text-[#9A3412] hover:bg-[#FFF7ED] dark:text-[#FDBA74]/85 dark:hover:bg-[#7C2D12]/40'
                      }`}
                    >
                      <span className="skew-x-12">VNR</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={previewSubject === 'mln131'}
                      onClick={() => setPreviewSubject('mln131')}
                      className={`inline-flex -skew-x-12 cursor-pointer items-center rounded-md border-2 px-2.5 py-0.5 text-[11px] font-black italic tracking-wider transition ${
                        previewSubject === 'mln131'
                          ? 'border-[#0C4A6E] bg-[#0284C7] text-white shadow-[2px_2px_0_0_#7DD3FC] dark:border-[#7DD3FC]'
                          : 'border-transparent text-[#075985] hover:bg-[#E0F2FE] dark:text-[#7DD3FC]/85 dark:hover:bg-[#0C4A6E]/40'
                      }`}
                    >
                      <span className="skew-x-12">MLN</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {activePred.tiers.map((tierSpec) => {
                    const isLazyMax = tierSpec.tier === 'lazymax';
                    return (
                      <div
                        key={tierSpec.tier}
                        className={`overflow-hidden rounded-xl border-2 bg-[#FFFFFF] dark:bg-[#1E221F] ${
                          isLazyMax
                            ? 'border-[#10B981]/70 dark:border-[#10B981]/60'
                            : 'border-[#F59E0B]/70 dark:border-[#F59E0B]/60'
                        }`}
                      >
                        <div
                          className={`flex items-center justify-between gap-2 border-b px-2.5 py-2 sm:px-3 ${
                            isLazyMax
                              ? 'border-[#A7F3D0] bg-[#ECFDF5] dark:border-[#059669]/45 dark:bg-[#064E3B]/35'
                              : 'border-[#FDE68A] bg-[#FFFBEB] dark:border-[#D97706]/45 dark:bg-[#78350F]/35'
                          }`}
                        >
                          <SakugaMangaTag
                            label={tierSpec.label}
                            tone={tierSpec.tone}
                            animateBurst={false}
                          />
                          <span className="tabular-nums text-[11px] font-bold text-[#292524] dark:text-[#E7E5E4]">
                            {tierSpec.countText}
                          </span>
                        </div>

                        <div className="divide-y divide-[#EAE6DD] dark:divide-[#2C302B]">
                          <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1.08fr)_repeat(4,minmax(0,0.86fr))] items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold tracking-wide text-[#656058] uppercase dark:text-[#9CA39B] sm:gap-1.5 sm:px-3">
                            <span>Cách học</span>
                            <span className="text-center">TB</span>
                            <span className="text-right">≥5</span>
                            <span className="text-right">≥7</span>
                            <span className="text-right">≥8</span>
                            <span className="text-right">≥9</span>
                          </div>

                          {tierSpec.rows.map((row) => {
                            const isFeat = Boolean(row.featured);
                            return (
                              <div
                                key={row.method}
                                className={`grid grid-cols-[minmax(0,1.35fr)_minmax(0,1.08fr)_repeat(4,minmax(0,0.86fr))] items-center gap-1 px-2.5 py-2 sm:gap-1.5 sm:px-3 ${
                                  isFeat
                                    ? isLazyMax
                                      ? 'border-l-[3px] border-l-[#059669] bg-[#ECFDF5]/85 dark:border-l-[#34D399] dark:bg-[#064E3B]/30'
                                      : 'border-l-[3px] border-l-[#D97706] bg-[#FFFBEB]/90 dark:border-l-[#FBBF24] dark:bg-[#78350F]/25'
                                    : ''
                                }`}
                              >
                                <div className="min-w-0">
                                  <span
                                    className={`block truncate text-[11px] sm:text-xs ${
                                      isFeat
                                        ? 'font-extrabold text-[#18181B] dark:text-[#F5F5F4]'
                                        : 'font-semibold text-[#292524] dark:text-[#E7E5E4]'
                                    }`}
                                  >
                                    {row.method}
                                  </span>
                                  {isFeat && (
                                    <span
                                      className={`block text-[9.5px] font-bold leading-tight ${
                                        isLazyMax
                                          ? 'text-[#047857] dark:text-[#34D399]'
                                          : 'text-[#B45309] dark:text-[#FBBF24]'
                                      }`}
                                    >
                                      ★ Khuyên dùng
                                    </span>
                                  )}
                                </div>

                                <div className="text-center tabular-nums">
                                  <span className="block text-[11.5px] font-extrabold text-[#18181B] dark:text-[#F5F5F4] sm:text-xs">
                                    {row.avg}
                                  </span>
                                  <span className="block text-[9px] leading-tight text-[#656058] dark:text-[#9CA39B]">
                                    {row.range}
                                  </span>
                                </div>

                                <span className={`text-right tabular-nums text-[10.5px] sm:text-[11px] ${getPctToneClass(row.p5)}`}>
                                  {row.p5}
                                </span>
                                <span className={`text-right tabular-nums text-[10.5px] sm:text-[11px] ${getPctToneClass(row.p7)}`}>
                                  {row.p7}
                                </span>
                                <span className={`text-right tabular-nums text-[10.5px] sm:text-[11px] ${getPctToneClass(row.p8)}`}>
                                  {row.p8}
                                </span>
                                <span className={`text-right tabular-nums text-[10.5px] sm:text-[11px] ${getPctToneClass(row.p9)}`}>
                                  {row.p9}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default TierInfoModal;
