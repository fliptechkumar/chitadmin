import type { Buffer } from 'buffer'
import { useCallback, useEffect, useState } from 'react'

import { useOverlay } from '@/components/overlays'
import {
  bluetoothPrintSupported,
  getSavedPrinter,
  openBluetoothSettings,
  pairedDevices,
  printBytes,
  savePrinter,
  type SavedPrinter,
} from '@/lib/bt-printer'
import { printHtml } from '@/lib/print'

/**
 * The receipt printer the collector picked, and printing to it. The choice is
 * remembered on the phone, so it is only asked for the first time.
 *
 * Where Bluetooth printing is unavailable (Expo Go, iOS) it falls back to the
 * phone's print dialog with the HTML version.
 */
export function usePrinter() {
  const { pick, toast, confirm } = useOverlay()
  const [printer, setPrinter] = useState<SavedPrinter | null>(null)

  useEffect(() => {
    getSavedPrinter().then(setPrinter)
  }, [])

  const choose = useCallback(async (): Promise<SavedPrinter | null> => {
    const devices = await pairedDevices()
    if (!devices.length) {
      const open = await confirm({
        title: 'No paired printer',
        text: 'Switch the printer on and pair it in the phone’s Bluetooth settings, then try again.',
        ok: 'Open Bluetooth',
        icon: 'bluetooth',
      })
      if (open) openBluetoothSettings()
      return null
    }
    const address = await pick({
      title: 'Choose receipt printer',
      value: printer?.address ?? null,
      options: devices.map((d) => ({ value: d.address, label: d.name, sub: d.address })),
    })
    const chosen = devices.find((d) => d.address === address)
    if (!chosen) return null
    await savePrinter(chosen)
    setPrinter(chosen)
    return chosen
  }, [confirm, pick, printer?.address])

  const forget = useCallback(async () => {
    await savePrinter(null)
    setPrinter(null)
  }, [])

  /** Prints `escpos` over Bluetooth, or `html` through the print dialog where that is not possible. */
  const print = useCallback(
    async ({ escpos, html }: { escpos: () => Buffer; html: () => string }) => {
      if (!bluetoothPrintSupported) return printHtml(html())
      const target = printer ?? (await getSavedPrinter()) ?? (await choose())
      if (!target) return
      await printBytes(target, escpos())
      toast(`Sent to ${target.name}`)
    },
    [choose, printer, toast],
  )

  return { printer, supported: bluetoothPrintSupported, choose, forget, print }
}
