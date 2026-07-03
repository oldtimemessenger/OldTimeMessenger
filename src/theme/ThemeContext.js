import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { buildTheme } from './theme';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const ThemeCtx = createContext({ theme: buildTheme('dark', 'blue') });

export function ThemeProvider({ children }) {
  const system = useColorScheme();
  const { profile, user } = useAuth();
  const [themeMode, setThemeModeState] = useState(system || 'dark');
  const [accentMode, setAccentModeState] = useState('blue');

  useEffect(() => {
    if (profile?.theme_mode) setThemeModeState(profile.theme_mode);
    if (profile?.accent_mode) setAccentModeState(profile.accent_mode);
  }, [profile?.theme_mode, profile?.accent_mode]);

  const persist = async (patch) => {
    if (!user) return;
    await supabase.from('profiles').update(patch).eq('id', user.id);
  };

  const setThemeMode = (mode) => { setThemeModeState(mode); persist({ theme_mode: mode }); };
  const setAccentMode = (mode) => { setAccentModeState(mode); persist({ accent_mode: mode }); };

  const theme = useMemo(() => buildTheme(themeMode, accentMode), [themeMode, accentMode]);

  return (
    <ThemeCtx.Provider value={{ theme, themeMode, setThemeMode, accentMode, setAccentMode }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}
