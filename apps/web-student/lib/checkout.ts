'use client';
import { apiPost } from '@aci/web-shared';

export interface PaymentOrderResponse {
  orderId: string;
  orderNo: string;
  provider: string;
  status: string;
  checkout: Record<string, any>;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the payment gateway. Check your connection.'));
    document.body.appendChild(s);
  });
}

const returnUrl = (orderId: string) => `/payments/return?orderId=${orderId}`;

/**
 * Opens the active gateway's checkout. Every path ends on /payments/return, which asks the
 * server to verify the payment with the gateway — the browser's word is never trusted.
 */
export async function startCheckout(order: PaymentOrderResponse, navigate: (url: string) => void): Promise<void> {
  const c = order.checkout;
  switch (c.type) {
    case 'mock':
      window.location.href = c.url;
      return;

    case 'razorpay': {
      await loadScript('https://checkout.razorpay.com/v1/checkout.js');
      const Razorpay = (window as any).Razorpay;
      await new Promise<void>((resolve) => {
        const rzp = new Razorpay({
          key: c.keyId,
          order_id: c.orderId,
          amount: c.amount,
          currency: c.currency,
          name: c.name,
          description: c.description,
          prefill: c.prefill,
          notes: c.notes,
          theme: { color: '#d0262e' },
          handler: async (resp: Record<string, string>) => {
            try {
              await apiPost(`/payments/${order.orderId}/verify`, resp);
            } finally {
              navigate(returnUrl(order.orderId));
              resolve();
            }
          },
          modal: { ondismiss: () => resolve() },
        });
        rzp.on('payment.failed', () => undefined); // Razorpay lets the user retry inside the modal
        rzp.open();
      });
      return;
    }

    case 'cashfree': {
      await loadScript('https://sdk.cashfree.com/js/v3/cashfree.js');
      const cashfree = (window as any).Cashfree({ mode: c.mode === 'production' ? 'production' : 'sandbox' });
      await cashfree.checkout({ paymentSessionId: c.paymentSessionId, redirectTarget: '_self' });
      return;
    }

    case 'payu': {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = c.action;
      for (const [k, v] of Object.entries(c.fields as Record<string, string>)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = k;
        input.value = v;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
      return;
    }

    default:
      throw new Error(`Unsupported payment provider: ${c.type}`);
  }
}
