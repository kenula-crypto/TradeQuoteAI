import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useStore } from '@/store';
import { Brand } from '@/constants/theme';

export default function RootLayout() {
  const { session, loading, setSession } = useAuthStore();
  const { loadUserData, clearData } = useStore();
  const segments = useSegments();
  const router   = useRouter();

  // Listen to Supabase auth state
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        if (session?.user) loadUserData(session.user.id);
      })
      .catch(() => setSession(null)); // force loading=false even if Supabase fails

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        if (session?.user) {
          await loadUserData(session.user.id);
        } else {
          clearData();
        }
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  // Redirect based on auth state
  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    if (!session && !inAuth) router.replace('/(auth)/login');
    if (session  &&  inAuth) router.replace('/(tabs)');
  }, [session, loading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="quote" />
    </Stack>
  );
}
