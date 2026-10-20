import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs'
import { Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Icon, type IconName } from '@/components/Icon'
import { Txt } from '@/components/ui'
import { useTheme } from '@/theme/theme'

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Home', icon: 'home' },
  { name: 'customers', label: 'Customers', icon: 'users' },
  { name: 'records', label: 'Records', icon: 'records' },
  { name: 'groups', label: 'Groups', icon: 'layers' },
  { name: 'reports', label: 'Reports', icon: 'chart' },
]

/** The prototype's tab bar: an icon in a pill that fills when active. */
function TabBar({ state, navigation }: BottomTabBarProps) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.divider, paddingBottom: insets.bottom }}>
      {state.routes.map((route, index) => {
        const tab = TABS.find((t) => t.name === route.name)
        if (!tab) return null
        const focused = state.index === index
        const color = focused ? c.primary : c.subtle
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params)
            }}
            style={{ flex: 1, height: 64, alignItems: 'center', justifyContent: 'center', gap: 3 }}
          >
            <View style={{ width: 52, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? c.primarySoft : 'transparent' }}>
              <Icon name={tab.icon} size={22} color={color} strokeWidth={focused ? 2.1 : 1.8} />
            </View>
            <Txt size={11} weight="semibold" color={color}>
              {tab.label}
            </Txt>
          </Pressable>
        )
      })}
    </View>
  )
}

export default function TabsLayout() {
  const { c } = useTheme()
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  )
}
