import React from 'react';
import { Heart, RefreshCw, Sparkles, X } from 'lucide-react';

interface HeartsModalProps {
  hearts: number;
  maxHearts: number;
  onStartRecoveryQuiz: () => void;
  onRefillHearts: () => void;
  onClose: () => void;
}

export const HeartsModal: React.FC<HeartsModalProps> = ({
  hearts,
  maxHearts,
  onStartRecoveryQuiz,
  onRefillHearts,
  onClose,
}) => {
  const isDepleted = hearts <= 0;

  return (
    <div
      data-testid="hearts-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#050d09]/65 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-duo-pop w-full max-w-md rounded-3xl border-2 border-[#d6e7dc] bg-white p-6 shadow-2xl dark:border-[#294737] dark:bg-[#112018]"
      >
        <div className="flex items-start justify-between">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-950/60">
            <Heart
              className={`h-8 w-8 ${
                isDepleted ? 'text-rose-400' : 'fill-rose-500 text-rose-500'
              }`}
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij okno serc"
            className="rounded-xl p-1.5 text-[#6b8274] hover:bg-[#ebf5ee] hover:text-[#2c4235] dark:hover:bg-[#182b21] dark:hover:text-[#e6f2ea]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <h2 className="mt-4 font-display text-2xl font-extrabold text-emerald-950 dark:text-white">
          {isDepleted ? 'Brak serc! Czas na powtórkę' : `Masz ${hearts}/${maxHearts} serc`}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#354c3f] dark:text-[#c7dbcf]">
          {isDepleted
            ? 'Wykorzystałeś wszystkie serca w tej sesji. Zrób krótką powtórkę trudniejszych struktur, aby odzyskać życie, lub uzupełnij pasek serc.'
            : 'Każda błędna odpowiedź w lekcji kosztuje 1 serce. Możesz w dowolnym momencie powtórzyć słabsze zagadnienia lub uzupełnić zapas.'}
        </p>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            data-testid="btn-heart-recovery-quiz"
            onClick={onStartRecoveryQuiz}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-4 py-3.5 text-sm font-extrabold text-white transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Szybka powtórka na odzyskanie serca</span>
          </button>

          <button
            type="button"
            data-testid="btn-refill-hearts"
            onClick={onRefillHearts}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-b-4 border-emerald-600 bg-white px-4 py-3.5 text-sm font-extrabold text-emerald-700 transition hover:bg-emerald-50 active:translate-y-0.5 active:border-b-2 dark:border-emerald-700 dark:bg-[#182b21] dark:text-emerald-300 dark:hover:bg-[#20382b]"
          >
            <Sparkles className="h-4 w-4" />
            <span>Uzupełnij serca ({maxHearts}/{maxHearts})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
