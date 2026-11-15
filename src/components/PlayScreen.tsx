import { useMemo } from 'react'
import { SCENARIO, getRound } from '../engine/scenario'
import { currentTips } from '../lib/tips'
import { useGame } from '../store/game'
import { useLive } from '../store/live'
import { KEY_LABEL, fmtDecision } from './chartKit'
import { ConstraintMonitor } from './ConstraintMonitor'
import { DecisionPanel } from './DecisionPanel'
import { GuideButton, RoundIntro } from './Guide'
import { LiveStats, SimControls } from './LiveStats'
import { ProfitMonitor } from './ProfitMonitor'
import { ShopScene } from './ShopScene'
import { TopBar } from './TopBar'

export function PlayScreen() {
  const round = useGame((s) => s.round)
  const draft = useGame((s) => s.draft)
  const tried = useGame((s) => s.tried)
  const liveSeed = useGame((s) => s.liveSeed)
  const tries = useGame((s) => s.tries)
  const introOpen = useGame((s) => s.introOpen)
  const setIntroOpen = useGame((s) => s.setIntroOpen)
  const live = useLive((s) => s.metrics)
  const r = getRound(SCENARIO, round)

  const tips = useMemo(() => currentTips({ r, draft, tried, live, tries }), [r, draft, tried, live, tries])

  return (
    <>
      <TopBar right={<GuideButton key={round} tips={tips} />} />
      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3">
          <section aria-label="The shop" className="space-y-2 rounded-2xl bg-coffee-100/60 p-3">
            <SimControls />
            <ShopScene r={r} decision={tried} seed={liveSeed} />
            <p className="text-xs text-[#52514e]">
              Running:{' '}
              {r.decisions.map((k, i) => (
                <span key={k}>
                  {i > 0 && ' · '}
                  {KEY_LABEL[k]} {fmtDecision(k, tried[k])}
                </span>
              ))}
              {tries === 0 && ' (the starting plan; change the sliders and press Try Solution)'}
            </p>
          </section>
          <LiveStats r={r} />
          <div className="rounded-xl bg-coffee-50 p-3 text-xs text-[#52514e] ring-1 ring-coffee-100">
            <b className="text-coffee-900">Round {r.round}: {r.title}.</b> {r.wrinkle}. Customers arrive at random, so the same plan plays out differently every
            time you run it. Your score is one fresh 5-day run of the plan you submit.
          </div>
        </div>
        <div className="space-y-3">
          <DecisionPanel r={r} />
          <ConstraintMonitor r={r} draft={draft} />
          <ProfitMonitor key={round} r={r} draft={draft} />
        </div>
      </main>
      {introOpen && <RoundIntro r={r} onClose={() => setIntroOpen(false)} />}
    </>
  )
}
