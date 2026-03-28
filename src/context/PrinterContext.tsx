import { createContext, useContext, useReducer, type ReactNode, type Dispatch } from 'react';

export type PrinterStatus = 'disconnected' | 'connecting' | 'ready' | 'printing';

export interface PrinterState {
  status: PrinterStatus;
  modelName: string | null;
  deviceName: string | null;
  printWidth: number;
}

type PrinterAction =
  | { type: 'CONNECTING' }
  | { type: 'CONNECTED'; modelName: string; deviceName: string; printWidth: number }
  | { type: 'DISCONNECTED' }
  | { type: 'PRINTING' }
  | { type: 'PRINT_DONE' };

const initialState: PrinterState = {
  status: 'disconnected',
  modelName: null,
  deviceName: null,
  printWidth: 576,
};

function printerReducer(state: PrinterState, action: PrinterAction): PrinterState {
  switch (action.type) {
    case 'CONNECTING':
      return { ...state, status: 'connecting' };
    case 'CONNECTED':
      return {
        status: 'ready',
        modelName: action.modelName,
        deviceName: action.deviceName,
        printWidth: action.printWidth,
      };
    case 'DISCONNECTED':
      return { ...initialState };
    case 'PRINTING':
      return { ...state, status: 'printing' };
    case 'PRINT_DONE':
      return { ...state, status: 'ready' };
    default:
      return state;
  }
}

const PrinterStateContext = createContext<PrinterState>(initialState);
const PrinterDispatchContext = createContext<Dispatch<PrinterAction>>(() => {});

export function PrinterProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(printerReducer, initialState);
  return (
    <PrinterStateContext.Provider value={state}>
      <PrinterDispatchContext.Provider value={dispatch}>
        {children}
      </PrinterDispatchContext.Provider>
    </PrinterStateContext.Provider>
  );
}

export function usePrinterState() {
  return useContext(PrinterStateContext);
}

export function usePrinterDispatch() {
  return useContext(PrinterDispatchContext);
}
