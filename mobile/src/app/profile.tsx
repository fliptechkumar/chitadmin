import Constants from 'expo-constants'
import { Linking, ScrollView, View } from 'react-native'

import { useAuth } from '@/api/auth'
import { API_URL } from '@/api/client'
import type { Overview } from '@/api/types'
import { useApi } from '@/api/useApi'
import { Icon } from '@/components/Icon'
import { useOverlay } from '@/components/overlays'
import { AppBar, Avatar, Button, Card, ListGroup, ListRow, RowIcon, SectionHeader, StatTile, Switch, Txt } from '@/components/ui'
import { inrShort, titleCase } from '@/lib/format'
import { useTheme } from '@/theme/theme'
import { fs, sp } from '@/theme/tokens'

export default function Profile() {
  const { c, isDark, pref, setPref } = useTheme()
  const { user, logout } = useAuth()
  const { confirm, toast } = useOverlay()
  const { data } = useApi<Overview>('/api/v1/route/overview')
  const route = data?.route ?? user?.route

  async function signOut() {
    const ok = await confirm({
      title: 'Sign out?',
      text: 'You will need the route username and password to sign in again.',
      ok: 'Sign out',
      tone: 'danger',
      icon: 'logout',
    })
    if (ok) await logout()
  }

  const call = () => {
    if (data?.company.phone) Linking.openURL(`tel:${data.company.phone.replace(/[^\d+]/g, '')}`).catch(() => {})
    else toast('No office phone number is set', 'info')
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title="Profile" back />
      <ScrollView contentContainerStyle={{ padding: sp[4], paddingBottom: sp[8] }}>
        <Card pad style={{ flexDirection: 'row', alignItems: 'center', gap: sp[4] }}>
          <Avatar name={route?.name ?? user?.name ?? 'Route'} size="lg" round />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt size={fs.lg} weight="bold" color={c.ink} numberOfLines={1}>
              {route ? `${route.code} · ${titleCase(route.name)}` : user?.name}
            </Txt>
            <Txt size={fs.sm} muted style={{ marginTop: 2 }}>
              Route login · {user?.username}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Icon name="pin" size={12} color={c.muted} />
              <Txt size={fs.sm} muted>
                {route?.branch} branch
              </Txt>
            </View>
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: sp[3], marginTop: sp[3] }}>
          <StatTile label="Today" n={data ? inrShort(data.today.total) : '—'} />
          <StatTile label="Receipts" n={data?.today.receipts ?? '—'} />
          <StatTile label="Members" n={data?.counts.members ?? '—'} />
        </View>

        <SectionHeader title="Preferences" />
        <ListGroup>
          <ListRow
            onPress={() => setPref(isDark ? 'light' : 'dark')}
            lead={<RowIcon name="moon" tone="violet" />}
            title="Dark mode"
            sub={pref === 'system' ? 'Following the phone' : 'Easier on the eyes at night'}
            end={<Switch on={isDark} />}
          />
          {pref !== 'system' && (
            <ListRow onPress={() => setPref('system')} lead={<RowIcon name="sync" tone="info" />} title="Use phone setting" sub="Match the phone's light or dark mode" />
          )}
        </ListGroup>

        <SectionHeader title="Device" />
        <ListGroup>
          <ListRow lead={<RowIcon name="printer" tone="info" />} title="Receipt printing" sub="Uses the phone's print service" />
          <ListRow lead={<RowIcon name="globe" tone="primary" />} title="Server" sub={API_URL.replace(/^https?:\/\//, '')} />
        </ListGroup>

        <SectionHeader title="Account" />
        <ListGroup>
          <ListRow lead={<RowIcon name="lock" tone="primary" />} title="Change password" sub="Set by your branch admin in Settings → Routes" />
          <ListRow onPress={call} lead={<RowIcon name="help" tone="info" />} title="Help & support" sub={data?.company.phone ? `Call office: ${data.company.phone}` : 'Contact your branch office'} chevron />
        </ListGroup>

        <Button variant="dangerSoft" icon="logout" title="Sign out" onPress={signOut} block style={{ marginTop: sp[5] }} />
        <Txt size={12} color={c.subtle} align="center" style={{ marginTop: sp[3] }}>
          {data?.company.name ?? ''} · Version {Constants.expoConfig?.version ?? '1.0.0'}
        </Txt>
      </ScrollView>
    </View>
  )
}
