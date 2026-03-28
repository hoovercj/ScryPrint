export interface PrinterProfile {
  name: string;
  printWidth: number;
  paperWidthMm: number;
  orientation: 'portrait' | 'landscape';
  initCommands: number[];
  finCommands: number[];
  chunkSize: number;
  chunksPerBurst: number;
  burstDelayMs: number;
}

// ESC/POS + Phomemo vendor init for M02 family
const INIT_M02 = [
  0x1b, 0x40,             // ESC @ — initialize printer
  0x1f, 0x11, 0x02, 0x04, // Phomemo preamble
  0x1b, 0x61, 0x01,       // ESC a 1 — center align
  0x1f, 0x11, 0x24, 0x00, // Phomemo: disable auto-power-off during print
];

const FIN_M02 = [
  0x1b, 0x64, 0x02,       // ESC d 2 — feed 2 lines
  0x1b, 0x64, 0x02,       // feed again
  0x1f, 0x11, 0x08,       // Phomemo: end print
  0x1f, 0x11, 0x0e,       // Phomemo: post-print
  0x1f, 0x11, 0x07,       // Phomemo: motor off
  0x1f, 0x11, 0x09,       // Phomemo: finalize
];

const INIT_M04 = [
  0x1f, 0x11, 0x02, 0x04, // Phomemo preamble
  0x1f, 0x11, 0x37, 0x96, // Density / heat setting
  0x1f, 0x11, 0x0b,       // Continuous media mode
  0x1f, 0x11, 0x35, 0x00, // Raw (no compression)
];

const FIN_M04 = [
  0x1b, 0x64, 0x02,       // ESC d 2 — feed 2 lines
];

export const PROFILES: Record<string, PrinterProfile> = {
  M02: {
    name: 'M02',
    printWidth: 384,
    paperWidthMm: 48,
    orientation: 'portrait',
    initCommands: INIT_M02,
    finCommands: FIN_M02,
    chunkSize: 512,
    chunksPerBurst: 1,
    burstDelayMs: 50,
  },
  M02S: {
    name: 'M02S',
    printWidth: 576,
    paperWidthMm: 53,
    orientation: 'portrait',
    initCommands: INIT_M02,
    finCommands: FIN_M02,
    chunkSize: 512,
    chunksPerBurst: 2,
    burstDelayMs: 50,
  },
  M04S: {
    name: 'M04S',
    printWidth: 1232,
    paperWidthMm: 110,
    orientation: 'landscape',
    initCommands: INIT_M04,
    finCommands: FIN_M04,
    chunkSize: 205,
    chunksPerBurst: 3,
    burstDelayMs: 50,
  },
};

/**
 * Auto-detect printer profile from BLE device name.
 */
export function detectProfile(deviceName: string): PrinterProfile {
  const name = (deviceName || '').toUpperCase();
  if (name.includes('M04')) return PROFILES.M04S;
  if (name.includes('M02S') || name.includes('M02 PRO')) return PROFILES.M02S;
  if (name.includes('T02') || name.includes('M02')) return PROFILES.M02;
  return PROFILES.M02S; // safe default
}
