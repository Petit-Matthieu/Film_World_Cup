import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TournamentProvider } from './context/TournamentContext';
import Header from './components/Header';
import SearchPage from './pages/SearchPage';
import SelectionPage from './pages/SelectionPage';
import BracketPage from './pages/BracketPage';
import ResultsPage from './pages/ResultsPage';

export default function App() {
  return (
    <HashRouter>
      <TournamentProvider>
        <div className="min-h-screen bg-gray-950 text-white">
          <Header />
          <main>
            <Routes>
              <Route path="/" element={<SearchPage />} />
              <Route path="/select" element={<SelectionPage />} />
              <Route path="/bracket" element={<BracketPage />} />
              <Route path="/results" element={<ResultsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          {/* Footer */}
          <footer className="text-center py-6 text-xs text-gray-700 border-t border-gray-900">
            Film World Cup · 数据来源：豆瓣 · 仅供娱乐
          </footer>
        </div>
      </TournamentProvider>
    </HashRouter>
  );
}
