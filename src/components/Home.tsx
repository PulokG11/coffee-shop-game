import { SCENARIO } from '../engine/scenario'
import { hasSavedGame, useGame } from '../store/game'
import { CremaAvatar } from './Guide'
import { Logo } from './TopBar'

const STEPS = [
  ['Set a plan', 'Choose how many hot and cold coffees to brew each hour; later rounds add the price and the barista.'],
  ['Watch it run', 'Customers arrive at random. Brew too little and they leave empty-handed; brew too much and coffee is poured away.'],
  ['Submit and compare', 'Your plan runs one fresh five-day week next to the optimizer’s plan, with exactly the same customers.'],
  ['Move up a round', 'Each round adds a wrinkle: costs, pricing, long lines, group orders, and finally the barista’s speed.'],
]

export function Home() {
  const state = useGame()
  const saved = hasSavedGame(state)

  return (
    <main>
      <section className="relative overflow-hidden bg-[#1b2550]">
        <Shopfront />
        <div className="relative mx-auto max-w-[1400px] px-4 pb-8 md:absolute md:inset-x-0 md:bottom-[13%] md:pb-0">
          <div className="relative -mt-6 max-w-[34rem] rounded-xl border-[10px] border-[#8a5a35] bg-board p-6 shadow-[0_10px_30px_rgba(0,0,0,0.45)] md:mt-0 md:p-7">
            <div className="flex items-center gap-2 text-chalk-dim">
              <Logo size={26} />
              <span className="font-display text-lg">Coffee Shop Game</span>
            </div>
            <h1 className="mt-2 font-display text-4xl leading-[1.05] text-chalk sm:text-5xl">Can you run the shop better than the optimizer?</h1>
            <p className="mt-3 text-[17px] leading-relaxed text-chalk-dim">
              Eight rounds of brewing, pricing and staffing a café that never closes, while customers walk in at random.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {saved && (
                <button onClick={state.resume} className="btn btn-cherry px-6 py-3 text-xl">
                  Continue round {state.round}
                </button>
              )}
              <button onClick={state.newGame} className={`btn px-6 py-3 text-xl ${saved ? 'btn-chalk' : 'btn-cherry'}`}>
                {saved ? 'Start over' : 'Play the game'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1400px] gap-10 px-4 py-10 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <h2 className="font-display text-3xl text-chalk">How a round works</h2>
          <ol className="mt-4 space-y-4">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-marigold font-display text-xl text-marigold">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-display text-xl text-chalk">{t}</h3>
                  <p className="text-chalk-dim">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="space-y-6">
          <div className="flex items-start gap-3">
            <CremaAvatar size={56} />
            <p className="rounded-2xl rounded-tl-sm bg-paper p-4 text-ink">
              I’m <b>Crema</b>. I’ll brief you at the start of each round and pop up with tips while you play. Look for the{' '}
              <b className="text-cherry">!</b> next to my name.
            </p>
          </div>
          <div className="chalk-rule pt-5">
            <h2 className="font-display text-2xl text-chalk">Championship mode</h2>
            <p className="mt-1 text-chalk-dim">
              Class matches with a code and a weekly leaderboard are coming in a later version. Championships are for organized events; to play on your own,
              choose Play the game.
            </p>
          </div>
          <div className="chalk-rule pt-5">
            <h2 className="font-display text-2xl text-chalk">About</h2>
            <p className="mt-1 text-chalk-dim">
              An independent teaching game inspired by{' '}
              <a className="text-chalk underline underline-offset-2" href="https://www.gurobi.com/academics/gurobean" target="_blank" rel="noreferrer">
                Gurobean
              </a>{' '}
              from Gurobi Optimization and Prof. Larry Snyder (Lehigh University). It is not affiliated with or endorsed by them. The optimizer here is an exact
              search of the expected-profit model, not Gurobi. Scenario {SCENARIO.name}, version {SCENARIO.version}.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

/** The shop at blue hour. Decorative; every action lives in the chalkboard above it. */
function Shopfront() {
  const stars = [
    [80, 60], [190, 30], [260, 95], [340, 40], [470, 70], [600, 28], [720, 52], [820, 22], [960, 66], [1080, 34], [1150, 90], [40, 140], [300, 150],
  ]
  return (
    <svg viewBox="0 0 1200 600" preserveAspectRatio="xMaxYMax slice" className="block h-[300px] w-full md:h-[620px]" aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141d45" />
          <stop offset="0.55" stopColor="#3a4787" />
          <stop offset="1" stopColor="#c98f86" />
        </linearGradient>
        <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe3a3" />
          <stop offset="1" stopColor="#f6c56e" />
        </linearGradient>
        <radialGradient id="spill" cx="0.5" cy="0" r="0.8">
          <stop offset="0" stopColor="#ffd98a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lamp" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffe3a3" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ffe3a3" stopOpacity="0" />
        </radialGradient>
        <filter id="neon" x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern id="tiles" width="20" height="14" patternUnits="userSpaceOnUse">
          <rect width="20" height="14" fill="#a8cf9b" />
          <path d="M0 0H20M0 7H20M10 0V7M0 7V14M20 7V14" stroke="#93bd86" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="1200" height="600" fill="url(#sky)" />
      {stars.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="#f3f1dd" opacity="0.8" />
      ))}
      <circle cx="210" cy="110" r="22" fill="#f3f1dd" />
      <circle cx="221" cy="103" r="19" fill="#202a58" />
      {/* Distant city */}
      <g fill="#28316a">
        <rect x="0" y="330" width="70" height="150" />
        <rect x="75" y="280" width="60" height="200" />
        <rect x="140" y="350" width="90" height="130" />
        <rect x="235" y="300" width="55" height="180" />
        <rect x="295" y="360" width="100" height="120" />
        <rect x="1140" y="300" width="60" height="180" />
      </g>
      <g fill="#ffd56b" opacity="0.85">
        {[
          [90, 300], [110, 330], [90, 370], [160, 380], [200, 410], [250, 320], [260, 360], [320, 390], [360, 410], [20, 360], [1160, 330], [1175, 380],
        ].map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="7" height="9" />
        ))}
      </g>
      {/* Street */}
      <rect x="0" y="478" width="1200" height="52" fill="#9b958c" />
      <rect x="0" y="526" width="1200" height="8" fill="#6f6a63" />
      <rect x="0" y="534" width="1200" height="66" fill="#33333b" />
      <g stroke="#e8e2c8" strokeWidth="5" strokeDasharray="40 36">
        <line x1="0" y1="570" x2="1200" y2="570" />
      </g>
      <rect x="440" y="478" width="700" height="50" fill="url(#spill)" />
      {/* Building */}
      <rect x="430" y="118" width="710" height="360" fill="#eef1ea" />
      <rect x="418" y="104" width="734" height="22" rx="4" fill="#2a1d17" />
      <rect x="520" y="146" width="530" height="70" rx="6" fill="#8a5a35" />
      <rect x="528" y="154" width="514" height="54" rx="4" fill="#22302a" />
      <text x="785" y="194" textAnchor="middle" fontFamily="'Lilita One', system-ui" fontSize="40" fill="#eceee4">
        Coffee Shop Game
      </text>
      {/* Awning */}
      <g>
        {Array.from({ length: 13 }, (_, i) => (
          <rect key={i} x={470 + i * 48} y="228" width="48" height="44" fill={i % 2 ? '#ffffff' : '#c8283b'} />
        ))}
        {Array.from({ length: 13 }, (_, i) => (
          <path key={i} d={`M${470 + i * 48} 272 a24 14 0 0 0 48 0`} fill={i % 2 ? '#ffffff' : '#c8283b'} />
        ))}
        <rect x="462" y="222" width="640" height="10" rx="4" fill="#8e1626" />
      </g>
      {/* Window with the café inside */}
      <rect x="490" y="296" width="400" height="150" fill="url(#glass)" />
      <g fill="#8a5a35" opacity="0.55">
        <rect x="700" y="388" width="190" height="58" />
        <circle cx="560" cy="380" r="12" />
        <rect x="546" y="392" width="28" height="54" rx="10" />
        <circle cx="610" cy="384" r="11" />
        <rect x="597" y="395" width="26" height="51" rx="10" />
        <circle cx="760" cy="350" r="12" />
        <rect x="746" y="362" width="28" height="30" rx="10" />
      </g>
      <g stroke="#c8283b" strokeWidth="3">
        <line x1="620" y1="296" x2="620" y2="318" />
        <line x1="800" y1="296" x2="800" y2="318" />
      </g>
      <path d="M606 330h28l-8-12h-12z M786 330h28l-8-12h-12z" fill="#c8283b" />
      <rect x="490" y="296" width="400" height="150" fill="none" stroke="#2a1d17" strokeWidth="10" />
      <line x1="690" y1="296" x2="690" y2="446" stroke="#2a1d17" strokeWidth="7" />
      <text x="595" y="350" textAnchor="middle" fontFamily="'Lilita One', system-ui" fontSize="30" fill="#e8344a" filter="url(#neon)">
        Open 24h
      </text>
      <rect x="480" y="446" width="420" height="10" rx="3" fill="#c79a6c" />
      <rect x="430" y="456" width="710" height="22" fill="url(#tiles)" />
      {/* Door */}
      <rect x="930" y="296" width="120" height="182" fill="#2a1d17" />
      <rect x="942" y="308" width="96" height="110" fill="url(#glass)" />
      <circle cx="1030" cy="440" r="5" fill="#f2b134" />
      {/* Plant */}
      <path d="M1075 478l6-34h30l6 34z" fill="#c8283b" />
      <g fill="#6f9c62">
        <ellipse cx="1084" cy="430" rx="12" ry="26" transform="rotate(-20 1084 430)" />
        <ellipse cx="1104" cy="425" rx="12" ry="28" transform="rotate(18 1104 425)" />
        <ellipse cx="1095" cy="418" rx="10" ry="30" />
      </g>
      {/* Street lamp */}
      <rect x="1166" y="250" width="8" height="228" fill="#2a1d17" />
      <circle cx="1170" cy="250" r="60" fill="url(#lamp)" />
      <rect x="1156" y="236" width="28" height="18" rx="6" fill="#2a1d17" />
      <rect x="1160" y="252" width="20" height="6" fill="#ffe3a3" />
    </svg>
  )
}
