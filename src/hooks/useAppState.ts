import { useEffect, useState } from "react";
import { state, subscribe } from "../state/store";
import type { AppState } from "../types";

export function useAppState(): AppState {
  const [appState, setAppState] = useState<AppState>({ ...state });
  useEffect(() => {
    const unsub = subscribe((s) => setAppState({ ...s }));
    return unsub;
  }, []);
  return appState;
}
