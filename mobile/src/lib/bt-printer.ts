import { Buffer } from 'buffer'
import * as SecureStore from 'expo-secure-store'
import { NativeModules, PermissionsAndroid, Platform } from 'react-native'

/**
 * Sending receipts straight to a paired Bluetooth thermal printer over the
 * serial (SPP) profile. Most handheld receipt printers have no Android print
 * service, so the system print dialog never lists them.
 *
 * The printer is paired once in the phone's Bluetooth settings; the app only
 * lists paired devices, so it never scans and needs no location permission.
 */

export type SavedPrinter = { address: string; name: string }

const KEY = 'bt-printer'

/** False in Expo Go and on iOS, where the native module is not in the build. */
export const bluetoothPrintSupported = Platform.OS === 'android' && !!NativeModules.RNBluetoothClassic

// Loaded lazily so Expo Go, which lacks the native module, can still start.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bt = () => (require('react-native-bluetooth-classic') as typeof import('react-native-bluetooth-classic')).default

export async function getSavedPrinter(): Promise<SavedPrinter | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY)
    return raw ? (JSON.parse(raw) as SavedPrinter) : null
  } catch {
    return null
  }
}

export async function savePrinter(p: SavedPrinter | null) {
  if (p) await SecureStore.setItemAsync(KEY, JSON.stringify(p))
  else await SecureStore.deleteItemAsync(KEY)
}

/** Android 12+ asks before the app may talk to paired devices. */
async function ensureReady() {
  if (!bluetoothPrintSupported) throw new Error('Bluetooth printing needs the installed app, not Expo Go.')
  if (Number(Platform.Version) >= 31) {
    const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT)
    if (res !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error('Allow "Nearby devices" for this app in Settings to print.')
    }
  }
  if (!(await bt().isBluetoothEnabled())) {
    const on = await bt().requestBluetoothEnabled().catch(() => false)
    if (!on) throw new Error('Turn on Bluetooth to print.')
  }
}

/** Devices paired in the phone's Bluetooth settings. */
export async function pairedDevices(): Promise<SavedPrinter[]> {
  await ensureReady()
  const devices = await bt().getBondedDevices()
  return devices.map((d) => ({ address: d.address, name: d.name || d.address }))
}

/** The phone's Bluetooth settings, where the printer is paired. */
export function openBluetoothSettings() {
  if (bluetoothPrintSupported) bt().openBluetoothSettings()
}

async function connect(address: string) {
  if (await bt().isDeviceConnected(address).catch(() => false)) return
  await bt().connectToDevice(address, { connectionType: 'binary' })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Writes in small chunks: cheap printers have a tiny buffer and drop bytes
 * when a whole receipt arrives at once.
 */
async function write(address: string, data: Buffer) {
  for (let i = 0; i < data.length; i += 256) {
    await bt().writeToDevice(address, Buffer.from(data.subarray(i, i + 256)))
    await sleep(25)
  }
}

export async function printBytes(printer: SavedPrinter, data: Buffer) {
  await ensureReady()
  try {
    await connect(printer.address)
    await write(printer.address, data)
  } catch {
    // A connection left over from earlier can go stale when the printer
    // sleeps or is switched off; start a fresh one and try once more.
    await bt().disconnectFromDevice(printer.address).catch(() => {})
    try {
      await connect(printer.address)
      await write(printer.address, data)
    } catch {
      throw new Error(`Could not reach ${printer.name}. Check it is switched on and nearby.`)
    }
  }
}
