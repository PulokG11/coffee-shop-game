import { useEffect } from 'react'
import { Comparison } from './components/Comparison'
import { Home } from './components/Home'
import { PlayScreen } from './components/PlayScreen'
import { Summary } from './components/Summary'
import { TopBar } from './components/TopBar'
import { useGame } from './store/game'

export default function App() {
  const screen = useGame((s) => s.screen)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screen])

  return (
    <div className="min-h-screen">
      {screen === 'home' && <Home />}
      {screen === 'play' && <PlayScreen />}
      {screen === 'compare' && (
        <>
          <TopBar />
          <Comparison />
        </>
      )}
      {screen === 'summary' && (
        <>
          <TopBar />
          <Summary />
        </>
      )}
    </div>
  )
}
