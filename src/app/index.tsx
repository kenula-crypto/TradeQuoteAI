import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { Brand } from '@/constants/theme';

export default function RootIndex() {
  const { session, loading } = useAuthStore();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Brand.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Brand.orange} size="large" />
      </View>
    );
  }

  return <Redirect href={session ? '/(tabs)/' : '/(auth)/login'} />;
}
