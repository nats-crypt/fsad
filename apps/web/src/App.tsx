import { Outlet, useLocation } from 'react-router-dom';
import Navbar, { Footer } from './components/Navbar';

export default function App() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <div className="page-enter">
      {!isAdmin && <Navbar />}
      <main className={!isAdmin ? '' : ''}>
        <Outlet />
      </main>
      {!isAdmin && <Footer />}
    </div>
  );
}
