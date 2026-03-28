import { detectProfile, type PrinterProfile } from './printerProfiles.ts';

const SERVICE_UUID = '0000ff00-0000-1000-8000-00805f9b34fb';
const WRITE_UUID = '0000ff02-0000-1000-8000-00805f9b34fb';
const MAX_LINES_PER_BLOCK = 255;
const POST_PRINT_DELAY = 2000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface BLEPrinter {
  connect(): Promise<{ profile: PrinterProfile; deviceName: string }>;
  disconnect(): void;
  print(canvas: HTMLCanvasElement): Promise<void>;
  isConnected(): boolean;
}

let bleDevice: BluetoothDevice | null = null;
let bleCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
let useWriteWithoutResponse = true;
let activeProfile: PrinterProfile | null = null;

/** Floyd-Steinberg dithering + packing to 1-bit raster bytes. */
function canvasToPackedBytes(canvas: HTMLCanvasElement): Uint8Array {
  const w = canvas.width;
  const h = canvas.height;
  const bytesPerLine = w / 8;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, w, h);
  const pixels = imageData.data;

  // Convert to grayscale float array
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const px = i * 4;
    gray[i] = 0.299 * pixels[px] + 0.587 * pixels[px + 1] + 0.114 * pixels[px + 2];
  }

  // Floyd-Steinberg dithering
  const bw = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const oldVal = gray[idx];
      const newVal = oldVal < 128 ? 0 : 255;
      bw[idx] = newVal === 0 ? 1 : 0; // 1 = black dot
      const err = oldVal - newVal;
      if (x + 1 < w) gray[idx + 1] += err * 7 / 16;
      if (y + 1 < h && x - 1 >= 0) gray[(y + 1) * w + x - 1] += err * 3 / 16;
      if (y + 1 < h) gray[(y + 1) * w + x] += err * 5 / 16;
      if (y + 1 < h && x + 1 < w) gray[(y + 1) * w + x + 1] += err * 1 / 16;
    }
  }

  // Pack 8 pixels per byte, MSB = leftmost
  const result = new Uint8Array(bytesPerLine * h);
  let outIdx = 0;
  for (let y = 0; y < h; y++) {
    for (let xByte = 0; xByte < bytesPerLine; xByte++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        if (bw[y * w + xByte * 8 + bit]) {
          byte |= 1 << (7 - bit);
        }
      }
      // Avoid 0x0a (LF) which can be misinterpreted by printer firmware
      if (byte === 0x0a) byte = 0x14;
      result[outIdx++] = byte;
    }
  }
  return result;
}

/** Wrap raster data in GS v 0 commands, splitting into 255-line blocks. */
function buildPrintCommands(
  packedBytes: Uint8Array,
  height: number,
  bytesPerLine: number,
  profile: PrinterProfile,
): Uint8Array {
  const commands: number[] = [];
  commands.push(...profile.initCommands);

  let offset = 0;
  while (offset < height) {
    const lines = Math.min(MAX_LINES_PER_BLOCK, height - offset);
    // GS v 0 — print raster bit image
    commands.push(0x1d, 0x76, 0x30, 0x00);
    commands.push(bytesPerLine & 0xff, (bytesPerLine >> 8) & 0xff);
    commands.push(lines & 0xff, (lines >> 8) & 0xff);
    const start = offset * bytesPerLine;
    const end = start + lines * bytesPerLine;
    for (let i = start; i < end; i++) {
      commands.push(packedBytes[i]);
    }
    offset += lines;
  }

  commands.push(...profile.finCommands);
  return new Uint8Array(commands);
}

/** For wide printers (M04S), rotate 90° and top-align. */
function prepareForPrinter(canvas: HTMLCanvasElement, printWidth: number): HTMLCanvasElement {
  if (printWidth > 576) {
    const rotated = document.createElement('canvas');
    rotated.width = printWidth;
    rotated.height = canvas.width;
    const ctx = rotated.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, rotated.width, rotated.height);
    ctx.translate(canvas.height, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(canvas, 0, 0);
    return rotated;
  }
  return canvas;
}

/** Send data in chunked bursts per printer profile. */
async function sendData(data: Uint8Array, profile: PrinterProfile) {
  if (!bleCharacteristic) throw new Error('Not connected');
  const { chunkSize, chunksPerBurst, burstDelayMs } = profile;
  let chunkCount = 0;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    if (useWriteWithoutResponse) {
      await bleCharacteristic.writeValueWithoutResponse(chunk);
    } else {
      await bleCharacteristic.writeValue(chunk);
    }
    chunkCount++;
    if (chunkCount % chunksPerBurst === 0) {
      await sleep(burstDelayMs);
    }
  }
}

export function createBLEPrinter(
  onDisconnect: () => void,
): BLEPrinter {
  return {
    async connect() {
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'Mr.in_' },
          { namePrefix: 'M04' },
          { namePrefix: 'M02' },
          { namePrefix: 'T02' },
        ],
        optionalServices: [SERVICE_UUID],
      });

      device.addEventListener('gattserverdisconnected', () => {
        bleCharacteristic = null;
        bleDevice = null;
        activeProfile = null;
        onDisconnect();
      });

      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      const characteristic = await service.getCharacteristic(WRITE_UUID);

      bleDevice = device;
      bleCharacteristic = characteristic;
      useWriteWithoutResponse = characteristic.properties.writeWithoutResponse;

      const profile = detectProfile(device.name || '');
      activeProfile = profile;

      return { profile, deviceName: device.name || 'Unknown' };
    },

    disconnect() {
      if (bleDevice?.gatt?.connected) {
        bleDevice.gatt.disconnect();
      }
      bleDevice = null;
      bleCharacteristic = null;
      activeProfile = null;
    },

    async print(canvas: HTMLCanvasElement) {
      if (!bleCharacteristic || !activeProfile) {
        throw new Error('Printer not connected');
      }

      const prepared = prepareForPrinter(canvas, activeProfile.printWidth);
      const bytesPerLine = prepared.width / 8;
      const packed = canvasToPackedBytes(prepared);
      const commands = buildPrintCommands(packed, prepared.height, bytesPerLine, activeProfile);
      await sendData(commands, activeProfile);
      await sleep(POST_PRINT_DELAY);
    },

    isConnected() {
      return bleCharacteristic !== null && bleDevice?.gatt?.connected === true;
    },
  };
}
