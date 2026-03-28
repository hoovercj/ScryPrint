import { useCallback, useRef } from 'react';
import { usePrinterState, usePrinterDispatch } from '../context/PrinterContext.tsx';
import { createBLEPrinter, type BLEPrinter } from '../lib/printer/blePrinter.ts';

export function usePrinter() {
  const state = usePrinterState();
  const dispatch = usePrinterDispatch();
  const printerRef = useRef<BLEPrinter | null>(null);

  const connect = useCallback(async () => {
    dispatch({ type: 'CONNECTING' });
    try {
      const printer = createBLEPrinter(() => {
        dispatch({ type: 'DISCONNECTED' });
        printerRef.current = null;
      });
      const { profile, deviceName } = await printer.connect();
      printerRef.current = printer;
      dispatch({
        type: 'CONNECTED',
        modelName: profile.name,
        deviceName,
        printWidth: profile.printWidth,
      });
    } catch (e) {
      dispatch({ type: 'DISCONNECTED' });
      throw e;
    }
  }, [dispatch]);

  const disconnect = useCallback(() => {
    printerRef.current?.disconnect();
    printerRef.current = null;
    dispatch({ type: 'DISCONNECTED' });
  }, [dispatch]);

  const print = useCallback(async (canvas: HTMLCanvasElement) => {
    if (!printerRef.current) throw new Error('Printer not connected');
    dispatch({ type: 'PRINTING' });
    try {
      await printerRef.current.print(canvas);
      dispatch({ type: 'PRINT_DONE' });
    } catch (e) {
      dispatch({ type: 'DISCONNECTED' });
      throw e;
    }
  }, [dispatch]);

  return {
    ...state,
    connect,
    disconnect,
    print,
  };
}
