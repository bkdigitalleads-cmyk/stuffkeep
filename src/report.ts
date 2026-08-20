/**
 * Insurance-ready PDF report, generated fully on-device with expo-print.
 * This is the app's money moment: a claim-ready document of everything
 * you own, with photos, serials, values and totals.
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getItemsGroupedByRoom, getPhotos, getTotals, Item } from './db';
import { photoThumbBase64 } from './photos';
import { formatCents } from './money';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function itemRow(item: Item): Promise<string> {
  let thumb = '';
  if (item.photoCount > 0) {
    const photos = await getPhotos(item.id);
    if (photos.length > 0) {
      const b64 = await photoThumbBase64(photos[0].path);
      if (b64) {
        thumb = `<img src="data:image/jpeg;base64,${b64}" style="width:56px;height:56px;object-fit:cover;border-radius:6px;" />`;
      }
    }
  }
  const meta: string[] = [];
  if (item.serial) meta.push(`Serial/model: ${esc(item.serial)}`);
  if (item.notes) meta.push(esc(item.notes));
  return `
    <tr>
      <td class="thumb">${thumb}</td>
      <td>
        <div class="name">${esc(item.name)}</div>
        ${meta.length ? `<div class="meta">${meta.join(' · ')}</div>` : ''}
      </td>
      <td class="value">${item.valueCents > 0 ? formatCents(item.valueCents) : '—'}</td>
    </tr>`;
}

export async function buildReportHtml(): Promise<string> {
  const groups = await getItemsGroupedByRoom();
  const totals = await getTotals();
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let sections = '';
  for (const g of groups) {
    const roomTotal = g.items.reduce((s, it) => s + it.valueCents, 0);
    const rows: string[] = [];
    for (const it of g.items) rows.push(await itemRow(it));
    sections += `
      <h2>${esc(g.room)} <span class="roomtotal">${formatCents(roomTotal)}</span></h2>
      <table>${rows.join('')}</table>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1a202c; margin: 32px; }
  h1 { font-size: 22px; margin: 0 0 2px; }
  .sub { color: #64748b; font-size: 12px; margin-bottom: 4px; }
  .summary { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 10px; padding: 12px 16px; margin: 16px 0 8px; font-size: 13px; }
  .summary b { font-size: 16px; }
  h2 { font-size: 15px; border-bottom: 2px solid #0f766e; padding-bottom: 4px; margin: 22px 0 6px; }
  .roomtotal { float: right; color: #0f766e; font-weight: 600; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; }
  td { border-bottom: 1px solid #e2e8f0; padding: 7px 6px; vertical-align: top; font-size: 12px; }
  td.thumb { width: 60px; }
  td.value { text-align: right; white-space: nowrap; font-weight: 600; width: 90px; }
  .name { font-weight: 600; font-size: 13px; }
  .meta { color: #64748b; font-size: 11px; margin-top: 2px; }
  .footer { margin-top: 28px; color: #94a3b8; font-size: 10px; text-align: center; }
</style></head>
<body>
  <h1>Home Inventory Report</h1>
  <div class="sub">Generated ${today} · StuffKeep for iPhone · All data stored on-device</div>
  <div class="summary">
    Total documented value: <b>${formatCents(totals.totalCents)}</b>
    &nbsp;·&nbsp; ${totals.itemCount} item${totals.itemCount === 1 ? '' : 's'}
    &nbsp;·&nbsp; ${totals.photoCount} photo${totals.photoCount === 1 ? '' : 's'}
  </div>
  ${sections}
  <div class="footer">Keep a copy of this report outside your home (email it to yourself or store it in the cloud) so it survives whatever your stuff doesn't.</div>
</body></html>`;
}

export async function generateAndSharePdf(): Promise<void> {
  const html = await buildReportHtml();
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Your home inventory report',
      UTI: 'com.adobe.pdf',
    });
  }
}
