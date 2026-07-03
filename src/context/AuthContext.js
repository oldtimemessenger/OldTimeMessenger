import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return; }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setProfile(data || null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      loadProfile(session?.user?.id).finally(() => setLoading(false));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      loadProfile(session?.user?.id);
    });
    return () => listener?.subscription?.unsubscribe();
  }, [loadProfile]);

  const sendOtp = (phone) => supabase.auth.signInWithOtp({ phone });
  const verifyOtp = (phone, token) => supabase.auth.verifyOtp({ phone, token, type: 'sms' });

  const completeProfile = async ({ displayName, avatarUrl }) => {
    if (!session?.user) return { error: new Error('No session') };
    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id,
      phone: session.user.phone,
      display_name: displayName,
      avatar_url: avatarUrl || null,
      status: 'online',
    });
    if (!error) await loadProfile(session.user.id);
    return { error };
  };

  const signOut = () => supabase.auth.signOut();

  const value = {
    session,
    user: session?.user || null,
    profile,
    loading,
    sendOtp,
    verifyOtp,
    completeProfile,
    signOut,
    refreshProfile: () => loadProfile(session?.user?.id),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
