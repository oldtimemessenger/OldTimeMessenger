import { useEffect } from 'react';
import { AppState } from 'react-native';
import { usePathname } from 'expo-router';
import { adManager } from '@/lib/ad-manager';
import { surfaceForPath } from '@/lib/ad-policy';

export function AdMobInitializer() {
  const pathname = usePathname();

  useEffect(() => {
    void adManager.initialize();
  }, []);

  useEffect(() => {
    const surface = surfaceForPath(pathname);
    if (surface !== 'unknown') adManager.setActiveSurface(surface);
  }, [pathname]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') adManager.handleAppBackground();
      if (state === 'active') void adManager.handleAppForeground();
    });
    return () => subscription.remove();
  }, []);

  return null;
}