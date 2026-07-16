import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AuthProvider } from "./hooks/useAuth";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { MeetingRoomPage } from "./pages/MeetingRoomPage";
import { MyVideosPage } from "./pages/MyVideosPage";
import { RecordVideoPage } from "./pages/RecordVideoPage";
import { RecordingsPage } from "./pages/RecordingsPage";
import { SignupPage } from "./pages/SignupPage";
import { WatchVideoPage } from "./pages/WatchVideoPage";

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/meeting/:meetingCode"
            element={
              <ProtectedRoute>
                <MeetingRoomPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/meeting/:meetingCode/recordings"
            element={
              <ProtectedRoute>
                <RecordingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/videos/new"
            element={
              <ProtectedRoute>
                <RecordVideoPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/videos/mine"
            element={
              <ProtectedRoute>
                <MyVideosPage />
              </ProtectedRoute>
            }
          />
          <Route path="/videos/:videoId" element={<WatchVideoPage />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
