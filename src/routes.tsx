import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import AdminMenu from "./components/AdminMenu";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/home" element={<Home />} />
        <Route path="/admin" element={<AdminMenu />} />
      </Routes>
    </Router>
  );
}

export default App;
