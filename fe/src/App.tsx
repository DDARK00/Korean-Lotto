import { BrowserRouter, Routes, Route } from 'react-router-dom'
import CheckerPage from '@pages/Checker'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CheckerPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
