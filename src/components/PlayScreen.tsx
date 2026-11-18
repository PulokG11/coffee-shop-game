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
      <main className="mx-auto grid max-w-[1400px] gap-6 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_370px]">
        <div className="min-w-0 space-y-4">
          <section aria-label="The shop" className="overflow-hidden rounded-2xl border-[6px] border-[#8a5a35] bg-board-raised">
            <SimControls />
            <ShopScene r={r} decision={tried} seed={liveSeed} />
          </section>
          <LiveStats r={r} />
          <div className="chalk-rule pt-3 text-chalk-dim">
            <p>
              <span className="font-display text-lg text-chalk">Running now: </span>
              {r.decisions.map((k, i) => (
                <span key={k}>
                  {i > 0 && ', '}
                  {KEY_LABEL[k].toLowerCase()} {fmtDecision(k, tried[k])}
                </span>
              ))}
              {tries === 0 && '. This is the starting plan; change the sliders and press Try solution.'}
            </p>
            <p className="mt-1">
              Customers arrive at random, so the same plan plays out differently every time it runs. Your score is one fresh five-day week of the plan you submit.
            </p>
          </div>
        </div>
        <aside aria-label="Your plan and monitors" className="relative space-y-1">
          <div aria-hidden className="h-2.5 rounded-full bg-gradient-to-b from-[#d9dcd6] to-[#8f958f] shadow-[0_2px_0_rgba(0,0,0,0.35)]" />
          <DecisionPanel r={r} />
          <ConstraintMonitor r={r} draft={draft} />
          <ProfitMonitor key={round} r={r} draft={draft} />
        </aside>
      </main>
      {introOpen && <RoundIntro r={r} onClose={() => setIntroOpen(false)} />}
    </>
  )
}
