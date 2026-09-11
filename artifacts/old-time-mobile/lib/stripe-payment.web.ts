export async function confirmStripePayment(_input: {
  publishableKey: string;
  clientSecret: string;
}): Promise<{ canceled: boolean }> {
  throw new Error('Secure card checkout is available in the Old Time iOS and Android app.');
}