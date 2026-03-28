import { Routes, Route } from 'react-router-dom';
import { TopBar } from './components/TopBar.tsx';
import { Landing } from './pages/Landing.tsx';
import { Momir } from './pages/Momir.tsx';
import { Planechase } from './pages/Planechase.tsx';
import { Archenemy } from './pages/Archenemy.tsx';
import { Browse } from './pages/Browse.tsx';

export function App() {
  return (
    <>
      <TopBar />
      <main className="main-scroll">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/momir" element={<Momir />} />
          <Route path="/planechase" element={<Planechase />} />
          <Route path="/archenemy" element={<Archenemy />} />
          <Route path="/browse" element={<Browse />} />
        </Routes>
      </main>
    </>
  );
}
