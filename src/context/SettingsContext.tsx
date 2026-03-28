import { createContext, useContext, useReducer, useEffect, type ReactNode, type Dispatch } from 'react';

export interface Settings {
  autoPrint: boolean;
  printArt: boolean;
  hidePreview: boolean;
  includeFunny: boolean;
  ditheringMode: 'floyd-steinberg' | 'threshold';
  paperFeed: 'none' | 'single' | 'double';
  // Planechase
  planechaseSetFilter: string;
  planechaseCollapsedSets: string[];
  planechasePlayers: number;
  // Archenemy
  archenemySetFilter: string;
  archenemyCollapsedSets: string[];
}

type SettingsAction =
  | { type: 'SET'; key: keyof Settings; value: boolean | string | string[] | number }
  | { type: 'LOAD'; settings: Settings };

const defaults: Settings = {
  autoPrint: false,
  printArt: true,
  hidePreview: false,
  includeFunny: false,
  ditheringMode: 'floyd-steinberg',
  paperFeed: 'single',
  planechaseSetFilter: '',
  planechaseCollapsedSets: [],
  planechasePlayers: 4,
  archenemySetFilter: '',
  archenemyCollapsedSets: [],
};

const STORAGE_KEY = 'scryprint_settings';

function loadFromStorage(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaults;
}

function settingsReducer(state: Settings, action: SettingsAction): Settings {
  switch (action.type) {
    case 'SET':
      return { ...state, [action.key]: action.value };
    case 'LOAD':
      return action.settings;
    default:
      return state;
  }
}

const SettingsStateContext = createContext<Settings>(defaults);
const SettingsDispatchContext = createContext<Dispatch<SettingsAction>>(() => {});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(settingsReducer, defaults, () => loadFromStorage());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return (
    <SettingsStateContext.Provider value={state}>
      <SettingsDispatchContext.Provider value={dispatch}>
        {children}
      </SettingsDispatchContext.Provider>
    </SettingsStateContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsStateContext);
}

export function useSettingsDispatch() {
  return useContext(SettingsDispatchContext);
}
