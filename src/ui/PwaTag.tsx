import { useTranslation } from 'react-i18next'

/** Marks a control that does NOT exist on the real Quartz — or works differently there.
 *  Shows a coral "PWA" chip; hovering explains both sides so a student learns the real
 *  desk's equivalent: "here it's like this because X · on the Quartz it's done like this".
 *  Keeps the fidelity promise honest — the simulator never silently invents desk features. */
export function PwaTag({ sim, real }: { sim: string; real: string }) {
  const { t } = useTranslation()
  const title = t('common.pwaTitle', { sim, real })
  return (
    <span className="pwa-tag" title={title} aria-label={title}>PWA</span>
  )
}

/** The sibling marker: a control/feature that only works on the PHYSICAL Quartz — it exists
 *  on the real desk but can't do its real job in a browser (no hardware). Explains why, so
 *  the student knows this button is real but inert here (as opposed to not-yet-built). */
export function HwTag({ why }: { why: string }) {
  const { t } = useTranslation()
  const title = t('common.hwTitle', { why })
  return (
    <span className="hw-tag" title={title} aria-label={title}>HW</span>
  )
}
