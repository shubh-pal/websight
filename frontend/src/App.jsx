import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Result from './pages/Result';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/result/:jobId" element={<Result />} />
    </Routes>
  );
}
