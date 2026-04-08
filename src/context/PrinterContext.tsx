import { createContext, useContext, useReducer, useRef, type ReactNode, type Dispatch, type MutableRefObject } from 'react';
import type { BLEPrinter } from '../lib/printer/blePrinter.ts';

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
const PrinterRefContext = createContext<MutableRefObject<BLEPrinter | null>>({ current: null });

export function PrinterProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(printerReducer, initialState);
  const printerRef = useRef<BLEPrinter | null>(null);
  return (
    <PrinterStateContext.Provider value={state}>
      <PrinterDispatchContext.Provider value={dispatch}>
        <PrinterRefContext.Provider value={printerRef}>
          {children}
        </PrinterRefContext.Provider>
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

export function usePrinterRef() {
  return useContext(PrinterRefContext);
}
