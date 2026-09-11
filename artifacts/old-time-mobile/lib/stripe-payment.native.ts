import { initPaymentSheet, initStripe, presentPaymentSheet } from '@stripe/stripe-react-native';

export async function confirmStripePayment(input: {
  publishableKey: string;
  clientSecret: string;
}): Promise<{ canceled: boolean }> {
  await initStripe({ publishableKey: input.publishableKey });
  const sheet = await initPaymentSheet({
    merchantDisplayName: 'Old Time',
    paymentIntentClientSecret: input.clientSecret,
    allowsDelayedPaymentMethods: false,
  });
  if (sheet.error) throw new Error(sheet.error.message);
  const result = await presentPaymentSheet();
  if (result.error?.code === 'Canceled') return { canceled: true };
  if (result.error) throw new Error(result.error.message);
  return { canceled: false };
}