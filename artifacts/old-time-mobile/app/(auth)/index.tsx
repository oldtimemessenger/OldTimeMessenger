import { Redirect } from 'expo-router';
import { AUTH_BYPASS_ENABLED } from '@/lib/auth';

export default function AuthIndex() {
  return <Redirect href={(AUTH_BYPASS_ENABLED ? '/(tabs)' : '/(auth)/sign-in') as never} />;
}