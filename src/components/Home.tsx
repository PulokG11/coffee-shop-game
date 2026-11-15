import { SCENARIO } from '../engine/scenario'
import { hasSavedGame, useGame } from '../store/game'
import { CremaAvatar } from './Guide'
import { Logo } from './TopBar'

const STEPS = [
  ['Set a plan', 'Choose how many hot and cold coffees to brew each hour, and later the price and the barista.'],
  ['Watch it run', 'Customers arrive at random. Brew too little and they leave empty-handed; too much and coffee is poured away.'],
  ['Submit and compare', 'Your plan is scored on a fresh five-day run, side by side with the optimizer’s plan on the same customers.'],
  ['Eight rounds', 'Each round adds a wrinkle: costs, pricing, long lines, bigger orders, and finally the barista’s speed.'],
]

export function Home() {
  const state = useGame()
  const saved = hasSavedGame(state)

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <section className="overflow-hidden rounded-3xl bg-coffee-800 text-coffee-50 shadow-lg">
        <div className="grid gap-6 p-7 sm:p-10 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div>
            <div className="flex items-center gap-2 text-coffee-200">
              <Logo size={30} />
              <span className="text-sm font-semibold uppercase tracking-widest">Coffee Shop Game</span>
            </div>
            <h1 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-5xl">Can you run the shop better than the optimizer?</h1>
            <p className="mt-3 text-coffee-200">Nonlinear optimization · simulation · decisions under uncertainty</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {saved && (
                <button onClick={state.resume} className="rounded-xl bg-coffee-300 px-5 py-3 font-semibold text-coffee-900 hover:bg-coffee-200">
                  Continue round {state.round}
                </button>
              )}
              <button
                onClick={state.newGame}
                className={`rounded-xl px-5 py-3 font-semibold ${saved ? 'border-2 border-coffee-300 text-coffee-50 hover:bg-coffee-700' : 'bg-coffee-300 text-coffee-900 hover:bg-coffee-200'}`}
              >
                {saved ? 'Start a new game' : 'Play the Game'}
              </button>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl bg-coffee-50 p-4 text-coffee-900">
            <CremaAvatar size={52} />
            <p className="text-sm leading-relaxed">
              Hi, I’m <b>Crema</b>. I’ll explain what changes each round and pop up with tips while you play. Look for the <b className="text-[#d03b3b]">!</b> next to my name.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(([t, d], i) => (
          <div key={t} className="rounded-2xl bg-[#fffdf8] p-4 shadow-sm ring-1 ring-black/5">
            <div className="text-xs font-semibold text-coffee-500">Step {i + 1}</div>
            <h2 className="mt-0.5 font-semibold text-coffee-900">{t}</h2>
            <p className="mt-1 text-sm text-[#52514e]">{d}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl bg-[#fffdf8] p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="font-semibold text-coffee-900">Championship mode</h2>
          <p className="mt-1 text-sm text-[#52514e]">
            Class matches with a code and a weekly global leaderboard are coming in a later version. Championships are for organized events; to play on your own,
            choose <b>Play the Game</b>.
          </p>
          <button disabled className="mt-3 cursor-not-allowed rounded-lg border border-coffee-200 px-3 py-1.5 text-sm font-semibold text-coffee-400">
            Coming soon
          </button>
        </div>
        <div className="rounded-2xl bg-[#fffdf8] p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="font-semibold text-coffee-900">About this game</h2>
          <p className="mt-1 text-sm text-[#52514e]">
            An independent teaching prototype inspired by{' '}
            <a className="underline" href="https://www.gurobi.com/academics/gurobean" target="_blank" rel="noreferrer">
              Gurobean
            </a>
            , the coffee optimization game from Gurobi Optimization and Prof. Larry Snyder (Lehigh University). It is not affiliated with or endorsed by them. The
            optimizer here is an exact search of the expected-profit model, not Gurobi. Scenario: {SCENARIO.name} v{SCENARIO.version}.
          </p>
        </div>
      </section>
    </main>
  )
}
