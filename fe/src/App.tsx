import { BrowserRouter, Routes, Route } from 'react-router-dom'
import CheckerPage from '@pages/Checker'

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<CheckerPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
