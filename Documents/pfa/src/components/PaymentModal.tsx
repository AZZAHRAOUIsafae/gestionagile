import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { motion, AnimatePresence } from 'motion/react';
import { X, CreditCard, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

import { useTranslation } from 'react-i18next';

// Replace with your real publishable key or use a public one for testing
const stripePromise = loadStripe((import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');

interface CheckoutFormProps {
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

function CheckoutForm({ amount, onSuccess, onCancel }: CheckoutFormProps) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState('');

  useEffect(() => {
    // Create PaymentIntent as soon as the component mounts
    fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          setError(data.error || t('payment.failed'));
        }
      });
  }, [amount, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setProcessing(true);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
      clientSecret,
      {
        payment_method: {
          card: cardElement,
        },
      }
    );

    if (stripeError) {
      setError(stripeError.message || t('payment.failed'));
      setProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-muted p-4 rounded-xl">
        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-3">
          {t('payment.info')}
        </label>
        <div className="bg-card border rounded-lg p-3">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: 'var(--foreground)',
                  '::placeholder': {
                    color: 'var(--muted-foreground)',
                  },
                },
              },
            }}
          />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-100 text-red-600 rounded-lg text-xs flex items-center gap-2 font-bold animate-in slide-in-from-top-1">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <button
          type="submit"
          disabled={!stripe || processing || !clientSecret}
          className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl shadow-xl shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2"
        >
          {processing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <ShieldCheck className="w-5 h-5" />
              {t('payment.pay_button', { amount: amount.toLocaleString() })}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-bold text-muted-foreground hover:text-foreground transition-all"
        >
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}

interface PaymentModalProps {
  amount: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
}

export default function PaymentModal({ amount, isOpen, onClose, onSuccess, title }: PaymentModalProps) {
  const { t } = useTranslation();
  const displayTitle = title || t('payment.title');

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-card border rounded-[2rem] w-full max-w-sm p-8 shadow-2xl overflow-hidden"
          >
            {/* Background pattern */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
            
            <div className="relative z-10">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <CreditCard className="w-8 h-8 text-primary" />
                </div>
              </div>
              
              <div className="text-center mb-8">
                <h3 className="text-xl font-black">{displayTitle}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t('payment.subtitle')}</p>
              </div>

              <Elements stripe={stripePromise}>
                <CheckoutForm 
                  amount={amount} 
                  onSuccess={() => {
                    onSuccess();
                    onClose();
                  }} 
                  onCancel={onClose}
                />
              </Elements>

              <div className="mt-8 flex items-center justify-center gap-2 grayscale opacity-40">
                <span className="text-[8px] font-bold uppercase tracking-widest">Powered by Stripe</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
