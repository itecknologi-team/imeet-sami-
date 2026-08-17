import { useState } from "react";
import { LoginPage } from "./components/login/LoginPage";
import { MeetingPage } from "./components/meeting/MeetingPage";

type Screen = "login" | "meeting";

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");

  if (screen === "meeting") {
    return <MeetingPage onLeave={() => setScreen("login")} />;
  }
  return <LoginPage onSubmit={() => setScreen("meeting")} />;
}
