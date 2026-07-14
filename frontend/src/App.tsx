import { useEffect, useState } from "react";
import { getHealth } from "./services/api";

type ConnectionStatus = "checking" | "connected" | "disconnected";

function App() {
  const [status, setStatus] = useState<ConnectionStatus>("checking");

  useEffect(() => {
    getHealth()
      .then(() => setStatus("connected"))
      .catch(() => setStatus("disconnected"));
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-900">
      <p className="text-lg font-medium text-gray-800 dark:text-gray-200">
        {status === "checking" && "Checking backend connection..."}
        {status === "connected" && "Connected"}
        {status === "disconnected" && "Disconnected"}
      </p>
    </div>
  );
}

export default App;
