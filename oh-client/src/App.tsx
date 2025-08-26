import { BrowserRouter as Router, Routes, Route} from "react-router-dom"
import Home from "./Home.tsx"
import Admin from "./Admin.tsx"

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home/>}></Route>
        <Route path="/admin" element={<Admin/>}></Route>
      </Routes>
    </Router>
  )
}

export default App
