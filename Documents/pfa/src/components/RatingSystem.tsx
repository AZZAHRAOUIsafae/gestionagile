import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { dbService } from '../services/db';

interface RatingSystemProps {
  topographerId: string;
  clientId: string;
  clientName: string;
  onSuccess?: () => void;
}

export default function RatingSystem({ topographerId, clientId, clientName, onSuccess }: RatingSystemProps) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;

    setIsSubmitting(true);
    try {
      await dbService.addReview({
        topographerId,
        clientId,
        clientName,
        rating,
        comment
      });
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Evaluation failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-card border rounded-2xl p-6 space-y-4">
      <h3 className="font-bold text-lg">{t('ratings.title')}</h3>
      <p className="text-xs text-muted-foreground">{t('ratings.description')}</p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className="p-1 transition-all"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
            >
              <Star
                className={cn(
                  "w-8 h-8 transition-colors",
                  (hover || rating) >= star ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                )}
              />
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('ratings.placeholder')}
          className="w-full bg-muted border-none rounded-xl p-4 text-sm outline-none focus:ring-2 focus:ring-primary h-24 resize-none"
        />

        <button
          type="submit"
          disabled={rating === 0 || isSubmitting}
          className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl disabled:opacity-50 hover:opacity-90 transition-all"
        >
          {isSubmitting ? t('common.loading') || 'Envoi...' : t('ratings.submit')}
        </button>
      </form>
    </div>
  );
}
