/**
 * Thermal Renderer — renders card info to a Canvas for printing.
 * Ported from Devin-Cooper/momir-printer web/index.html.
 */

export interface CardRenderData {
  name: string;
  manaCost?: string;
  typeLine: string;
  oracleText?: string;
  power?: string;
  toughness?: string;
}

const RENDER_WIDTH = 576; // Standard render width; scaled to printer at print time
const PADDING = 12;
const CONTENT_WIDTH = RENDER_WIDTH - PADDING * 2;

function measureTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const test = currentLine ? currentLine + ' ' + word : word;
    if (ctx.measureText(test).width <= maxWidth) {
      currentLine = test;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length ? lines : [''];
}

/**
 * Render a card to a Canvas element.
 * Returns the canvas for printing or preview.
 */
export function renderCardToCanvas(card: CardRenderData, artImg?: HTMLImageElement | ImageBitmap | null): HTMLCanvasElement {
  // Measure phase
  const measure = document.createElement('canvas');
  const mctx = measure.getContext('2d')!;

  const nameFont = 'bold 36px sans-serif';
  const typeFont = '26px sans-serif';
  const textFont = '24px sans-serif';
  const ptFont = 'bold 34px sans-serif';

  const nameH = 36 + 8;

  let artH = 0;
  if (artImg) {
    const ratio = artImg.height / artImg.width;
    artH = Math.round(RENDER_WIDTH * ratio);
  }

  const typeH = 26 + 6;

  mctx.font = textFont;
  let rulesH = 0;
  const rulesLines: string[] = [];
  if (card.oracleText) {
    const paragraphs = card.oracleText.split('\n');
    for (const para of paragraphs) {
      rulesLines.push(...measureTextLines(mctx, para, CONTENT_WIDTH));
    }
    rulesH = (24 + 4) * rulesLines.length + 6 + 1 + 6;
  }

  let ptH = 0;
  if (card.power && card.toughness) {
    ptH = 34 + 8;
  }

  const totalHeight = nameH + 1 + 6
    + (artH ? artH + 6 + 1 + 6 : 0)
    + typeH + 1 + 6
    + rulesH
    + ptH
    + 4;

  // Draw phase
  const canvas = document.createElement('canvas');
  canvas.width = RENDER_WIDTH;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, RENDER_WIDTH, totalHeight);
  ctx.fillStyle = '#000';

  let y = 0;

  // Name + mana cost
  ctx.font = nameFont;
  const mana = card.manaCost || '';
  if (mana) {
    const manaW = ctx.measureText(mana).width;
    ctx.fillText(mana, RENDER_WIDTH - PADDING - manaW, y + 36);
    const maxNameW = CONTENT_WIDTH - manaW - 12;
    let displayName = card.name;
    while (ctx.measureText(displayName).width > maxNameW && displayName.length > 1) {
      displayName = displayName.slice(0, -1);
    }
    ctx.fillText(displayName, PADDING, y + 36);
  } else {
    ctx.fillText(card.name, PADDING, y + 36);
  }
  y += nameH;

  // Separator
  ctx.fillRect(PADDING, y, CONTENT_WIDTH, 1);
  y += 1 + 6;

  // Art
  if (artImg) {
    const ratio = artImg.height / artImg.width;
    const ah = Math.round(RENDER_WIDTH * ratio);
    ctx.drawImage(artImg, 0, y, RENDER_WIDTH, ah);
    y += ah + 6;
    ctx.fillRect(PADDING, y, CONTENT_WIDTH, 1);
    y += 1 + 6;
  }

  // Type line
  ctx.font = typeFont;
  ctx.fillText(card.typeLine, PADDING, y + 26);
  y += typeH;
  ctx.fillRect(PADDING, y, CONTENT_WIDTH, 1);
  y += 1 + 6;

  // Rules text
  if (rulesLines.length > 0 && card.oracleText) {
    ctx.font = textFont;
    for (const line of rulesLines) {
      ctx.fillText(line, PADDING, y + 24);
      y += 24 + 4;
    }
    y += 6;
    ctx.fillRect(PADDING, y, CONTENT_WIDTH, 1);
    y += 1 + 6;
  }

  // P/T
  if (card.power && card.toughness) {
    ctx.font = ptFont;
    const ptStr = `${card.power} / ${card.toughness}`;
    const ptW = ctx.measureText(ptStr).width;
    ctx.fillText(ptStr, RENDER_WIDTH - PADDING - ptW, y + 34);
  }

  return canvas;
}

/**
 * Render a keyword counter to a Canvas — simple text layout, no art.
 */
export function renderKeywordCounter(keyword: string, reminderText?: string): HTMLCanvasElement {
  const measure = document.createElement('canvas');
  const mctx = measure.getContext('2d')!;

  const keywordFont = 'bold 48px sans-serif';
  const reminderFont = '24px sans-serif';

  let reminderLines: string[] = [];
  if (reminderText) {
    mctx.font = reminderFont;
    reminderLines = measureTextLines(mctx, reminderText, CONTENT_WIDTH);
  }

  const keywordH = 48 + 16;
  const reminderH = reminderLines.length > 0 ? (24 + 4) * reminderLines.length + 16 : 0;
  const totalHeight = 24 + keywordH + (reminderH > 0 ? 8 + reminderH : 0) + 24;

  const canvas = document.createElement('canvas');
  canvas.width = RENDER_WIDTH;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, RENDER_WIDTH, totalHeight);

  // Border
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, RENDER_WIDTH - 12, totalHeight - 12);

  ctx.fillStyle = '#000';
  let y = 24;

  // Keyword name
  ctx.font = keywordFont;
  ctx.textAlign = 'center';
  ctx.fillText(keyword, RENDER_WIDTH / 2, y + 48);
  y += keywordH + 8;

  // Reminder text
  ctx.font = reminderFont;
  ctx.textAlign = 'left';
  for (const line of reminderLines) {
    ctx.fillText(line, PADDING, y + 24);
    y += 24 + 4;
  }

  ctx.textAlign = 'left'; // reset
  return canvas;
}
