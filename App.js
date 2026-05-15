import React, { useEffect, useState } from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet, useColorScheme, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useStore } from './src/store';
import { useKraftStore } from './src/store/kraftStore';
import { useTheme, ThemeProvider } from './src/theme';
import { AppStatusBar } from './src/components/ui';
import { useSafeAreaInsets, SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from './src/screens/HomeScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import InventoryAddScreen from './src/screens/InventoryAddScreen';
import CaloriesScreen from './src/screens/CaloriesScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import RecipesScreen from './src/screens/RecipesScreen';
import RecipeDetailScreen from './src/screens/RecipeDetailScreen';
import RecipeEditScreen from './src/screens/RecipeEditScreen';
import AuthScreen from './src/screens/AuthScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import BarcodeScannerScreen from './src/screens/BarcodeScannerScreen';
import ScanScreen from './src/screens/ScanScreen';
import ProfilScreen from './src/screens/ProfilScreen';
import DatePickerScreen from './src/screens/DatePickerScreen';
import TrainingScreen from './src/screens/TrainingScreen';
import KraftScreen from './src/screens/kraft/KraftScreen';
import LiveWorkoutScreen from './src/screens/kraft/LiveWorkoutScreen';
import WorkoutSummaryScreen from './src/screens/kraft/WorkoutSummaryScreen';
import RoutineEditScreen from './src/screens/kraft/RoutineEditScreen';
import RoutineDetailScreen from './src/screens/kraft/RoutineDetailScreen';
import ExerciseDatabaseScreen from './src/screens/kraft/ExerciseDatabaseScreen';
import ExerciseDetailScreen from './src/screens/kraft/ExerciseDetailScreen';
import KraftStatsScreen from './src/screens/kraft/KraftStatsScreen';
import GoalsScreen from './src/screens/GoalsScreen';
import ConnectedAppsScreen from './src/screens/ConnectedAppsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_ICONS = { Home: 'home', Speisekammer: 'package', Tracken: 'activity', Training: 'zap', Profil: 'user' };

function FloatingTabBar({ state, descriptors, navigation }) {
  const { colors: C, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        alignItems: 'center',
        paddingBottom: insets.bottom > 0 ? insets.bottom - 8 : 8,
      }}
    >
      <View style={{
        flexDirection: 'row',
        backgroundColor: isDark ? 'rgba(28,28,30,0.96)' : 'rgba(255,255,255,0.96)',
        borderRadius: 36,
        paddingVertical: 10,
        paddingHorizontal: 8,
        gap: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: isDark ? 0.5 : 0.15,
        shadowRadius: 24,
        elevation: 20,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      }}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const icon = TAB_ICONS[route.name] || 'circle';
          const badge = options.tabBarBadge;

          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              activeOpacity={0.7}
              style={{
                alignItems: 'center', justifyContent: 'center',
                paddingVertical: 6, paddingHorizontal: 16,
                borderRadius: 28,
                backgroundColor: focused
                  ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)')
                  : 'transparent',
                minWidth: 56,
              }}
            >
              <View style={{ position: 'relative' }}>
                <Feather
                  name={icon}
                  size={22}
                  color={focused ? C.text : C.textTertiary}
                />
                {badge > 0 && (
                  <View style={{
                    position: 'absolute', top: -4, right: -6,
                    backgroundColor: C.danger, borderRadius: 8,
                    minWidth: 15, height: 15, alignItems: 'center', justifyContent: 'center',
                    paddingHorizontal: 3,
                  }}>
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{badge}</Text>
                  </View>
                )}
              </View>
              <Text style={{
                fontSize: 10, fontWeight: focused ? '700' : '500',
                color: focused ? C.text : C.textTertiary,
                marginTop: 3,
              }}>
                {route.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Sub Tab Bar ───────────────────────────────────────────────────
function SubTabBar({ tabs, active, onChange }) {
  const { colors: C } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, flexDirection: 'row', backgroundColor: C.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
      {tabs.map(tab => (
        <TouchableOpacity
          key={tab}
          onPress={() => onChange(tab)}
          style={{ flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: active === tab ? C.accent : 'transparent' }}
        >
          <Text style={{ color: active === tab ? C.text : C.textTertiary, fontSize: 13, fontWeight: '600' }}>{tab}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Speisekammer: Inventar + Rezepte ─────────────────────────────
function SpeisekammerTabs({ navigation, route }) {
  const [active, setActive] = useState('Inventar');
  const tabBar = <SubTabBar tabs={['Inventar', 'Rezepte']} active={active} onChange={setActive} />;
  return active === 'Inventar'
    ? <InventoryScreen navigation={navigation} route={route} tabBar={tabBar} />
    : <RecipesScreen navigation={navigation} route={route} tabBar={tabBar} />;
}

// ── Tracken: Kalorien + Kalender ──────────────────────────────────
function TrackenTabs({ navigation, route }) {
  const [active, setActive] = useState('Kalorien');
  const tabBar = <SubTabBar tabs={['Kalorien', 'Kalender']} active={active} onChange={setActive} />;
  return active === 'Kalorien'
    ? <CaloriesScreen navigation={navigation} route={route} tabBar={tabBar} />
    : <CalendarScreen tabBar={tabBar} onSwitchToKalorien={() => setActive('Kalorien')} />;
}

// ── Stack Wrappers ────────────────────────────────────────────────
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="Profil" component={ProfilScreen} />
    </Stack.Navigator>
  );
}

function SpeisekammerStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SpeisekammerTabs" component={SpeisekammerTabs} />
      <Stack.Screen name="BarcodeScanner" component={BarcodeScannerScreen} />
      <Stack.Screen name="ScanModal" component={ScanScreen} />
      <Stack.Screen name="DatePicker" component={DatePickerScreen} />
      <Stack.Screen name="InventoryAdd" component={InventoryAddScreen} />
      <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
      <Stack.Screen name="RecipeEdit" component={RecipeEditScreen} />
    </Stack.Navigator>
  );
}

function TrackenStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TrackenTabs" component={TrackenTabs} />
      <Stack.Screen name="BarcodeScanner" component={BarcodeScannerScreen} />
      <Stack.Screen name="FoodSearch" component={require('./src/screens/FoodSearchScreen').default} />
    </Stack.Navigator>
  );
}

// ── Training: Plan + Kraft Sub-Tabs ──────────────────────────────
function TrainingKraftTabs({ navigation, route }) {
  const [active, setActive] = useState('Plan');
  const tabBar = <SubTabBar tabs={['Plan', 'Kraft']} active={active} onChange={setActive} />;
  return active === 'Plan'
    ? <TrainingScreen navigation={navigation} route={route} tabBar={tabBar} />
    : <KraftScreen navigation={navigation} route={route} tabBar={tabBar} />;
}

function TrainingStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TrainingMain" component={TrainingKraftTabs} />
      <Stack.Screen name="RoutineDetail" component={RoutineDetailScreen} />
      <Stack.Screen name="RoutineEdit" component={RoutineEditScreen} />
      <Stack.Screen name="LiveWorkout" component={LiveWorkoutScreen} options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="WorkoutSummary" component={WorkoutSummaryScreen} />
      <Stack.Screen name="ExerciseDatabase" component={ExerciseDatabaseScreen} />
      <Stack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} />
      <Stack.Screen name="KraftStats" component={KraftStatsScreen} />
    </Stack.Navigator>
  );
}

function ProfilStack() {
  const KoerperScreen = require('./src/screens/KoerperScreen').default;
  const SportprofilScreen = require('./src/screens/SportprofilScreen').default;
  const EinstellungenScreen = require('./src/screens/EinstellungenScreen').default;
  const KontoScreen = require('./src/screens/KontoScreen').default;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfilMain" component={ProfilScreen} />
      <Stack.Screen name="Goals" component={GoalsScreen} />
      <Stack.Screen name="ConnectedApps" component={ConnectedAppsScreen} />
      <Stack.Screen name="Koerper" component={KoerperScreen} />
      <Stack.Screen name="Sportprofil" component={SportprofilScreen} />
      <Stack.Screen name="Einstellungen" component={EinstellungenScreen} />
      <Stack.Screen name="Konto" component={KontoScreen} />
    </Stack.Navigator>
  );
}

// ── Main Tabs ─────────────────────────────────────────────────────
function MainTabs() {
  const { colors: C, spacing: S } = useTheme();
  const insets = useSafeAreaInsets();
  const { inventory } = useStore();

  const alertCount = inventory.filter(i => {
    if (!i.mhd) return false;
    return (new Date(i.mhd) - new Date()) / 86400000 <= 5;
  }).length;

  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen
        name="Speisekammer"
        component={SpeisekammerStack}
        options={{ tabBarBadge: alertCount > 0 ? alertCount : undefined }}
      />
      <Tab.Screen name="Tracken" component={TrackenStack} />
      <Tab.Screen name="Training" component={TrainingStack} />
      <Tab.Screen name="Profil" component={ProfilStack} />
    </Tab.Navigator>
  );
}

// ── Root ──────────────────────────────────────────────────────────
function AppContent() {
  const { user, init, updateProfile } = useStore();
  const kraftInit = useKraftStore(s => s.init);
  const [booting, setBooting] = useState(true);
  const { colors: C, isDark } = useTheme();

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: C.bg,
      card: C.bg,
      border: C.border,
      text: C.text,
      primary: C.accent,
    },
  };

  useEffect(() => {
    kraftInit();
    init().finally(() => setBooting(false));
  }, []);

  if (booting) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <AppStatusBar />
        <Text style={{ color: C.text, fontSize: 34, fontWeight: '700', letterSpacing: -1.5, marginBottom: 20 }}>
          keepr
        </Text>
        <ActivityIndicator color={C.textSecondary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme} key={user ? 'logged-in' : 'logged-out'}>
      <AppStatusBar />
      {user
        ? (user.onboardingComplete
            ? <MainTabs />
            : <OnboardingScreen onComplete={() => updateProfile({ onboardingComplete: true })} />
          )
        : (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Auth" component={AuthScreen} />
          </Stack.Navigator>
        )
      }
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
