import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Search from './pages/Search';
import Booking from './pages/Booking';
import Confirmation from './pages/Confirmation';
import MyBookings from './pages/MyBookings';
import Profile from './pages/Profile';
import PolicyPage from './pages/PolicyPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AircraftAdmin from './pages/admin/AircraftAdmin';
import EmployeesAdmin from './pages/admin/EmployeesAdmin';
import FlightsAdmin from './pages/admin/FlightsAdmin';
import CrewAdmin from './pages/admin/CrewAdmin';
import Attendance from './pages/admin/Attendance';
import Duty from './pages/admin/Duty';
import Optimizer from './pages/admin/Optimizer';
import Reports from './pages/admin/Reports';
import BookingsAdmin from './pages/admin/BookingsAdmin';
import LiveMap from './pages/admin/LiveMap';
import ProtectedRoute from './components/ProtectedRoute';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Landing /> },
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: 'forgot-password', element: <ForgotPassword /> },
      { path: 'reset-password', element: <ResetPassword /> },
      { path: 'search', element: <Search /> },
      {
        path: 'book/:flightId',
        element: (
          <ProtectedRoute>
            <Booking />
          </ProtectedRoute>
        ),
      },
      {
        path: 'confirmation/:bookingId',
        element: (
          <ProtectedRoute>
            <Confirmation />
          </ProtectedRoute>
        ),
      },
      {
        path: 'my-bookings',
        element: (
          <ProtectedRoute>
            <MyBookings />
          </ProtectedRoute>
        ),
      },
      {
        path: 'profile',
        element: (
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        ),
      },
      { path: 'policy/:slug', element: <PolicyPage /> },
    ],
  },
  {
    path: '/admin',
    element: (
      <ProtectedRoute role={['STAFF', 'ADMIN']}>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: 'live-map', element: <LiveMap /> },
      { path: 'aircraft', element: <AircraftAdmin /> },
      { path: 'employees', element: <EmployeesAdmin /> },
      { path: 'flights', element: <FlightsAdmin /> },
      { path: 'bookings', element: <BookingsAdmin /> },
      { path: 'crew', element: <CrewAdmin /> },
      { path: 'attendance', element: <Attendance /> },
      { path: 'duty', element: <Duty /> },
      { path: 'optimizer', element: <Optimizer /> },
      { path: 'reports', element: <Reports /> },
    ],
  },
]);
