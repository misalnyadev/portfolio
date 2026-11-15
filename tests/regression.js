/* Tes regresi AK Talent. Jalankan: node tests/regression.js   (butuh: npm i playwright && npx playwright install chromium)
   Memakai server statis bawaan, data uji disimpan di browser sementara dan dibersihkan. */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const srv = http.createServer((q, r) => { const f = path.join(ROOT, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200); r.end(d); } }); });
const results = []; let page, errs = [];
async function t(name, fn) { const before = errs.length; try { await fn(); if (errs.length > before) throw new Error('page error: ' + errs.slice(before).join(' | ')); results.push([name, true]); console.log('  ok   ' + name); } catch (e) { results.push([name, false, e.message]); console.log('  GAGAL ' + name + '\n        ' + String(e.message).split('\n')[0]); } }
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'tidak sama') + ': dapat ' + JSON.stringify(a) + ', harusnya ' + JSON.stringify(b)); };
const ok = (c, m) => { if (!c) throw new Error(m || 'kondisi salah'); };
const wait = (ms) => page.waitForTimeout(ms);

(async () => {
  await new Promise(r => srv.listen(0, r)); const url = 'http://localhost:' + srv.address().port + '/index.html';
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => d.accept());
  await page.goto(url); await wait(900);
  const blob = (w, h, c) => page.evaluate(async ([w, h, c]) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, w, h); return cv.toDataURL('image/png'); }, [w, h, c]);
  const seed = async () => { const V = await blob(600, 800, '#468'), H = await blob(1280, 720, '#846');
    return page.evaluate(async ([V, H]) => { const b = async (u) => (await fetch(u)).blob();
      await idbPut('characters', { id: 'c1', createdAt: 1, updatedAt: Date.now(), basic: { name: 'Nurlela', profession: 'kuliner' }, traits: {} });
      const a1 = await putAsset(await b(V), { type: 'studio_image', characterId: 'c1', title: 'Vertikal', caption: 'cap v', portfolio: true });
      const a2 = await putAsset(await b(H), { type: 'studio_image', characterId: 'c1', title: 'Horizontal', caption: 'cap h', portfolio: true });
      return [a1, a2]; }, [V, H]); };
  const clean = () => page.evaluate(async () => { for (const s of ['assets', 'drafts', 'jobs', 'characters']) for (const r of await idbGetAll(s)) await idbDelete(s, r.id); });
  const ids = await seed();

  console.log('\nDasar');
  await t('versi aplikasi terbaca', async () => ok(/^\d{4}\.\d{2}\.\d{2}-[a-z]+$/.test(await page.evaluate(() => APP_VERSION)), 'format APP_VERSION'));
  for (const v of ['v-home', 'v-overview', 'v-build', 'v-studio', 'v-editor', 'v-list', 'v-portfolio', 'v-collab', 'v-settings'])
    await t('halaman ' + v + ' tampil tanpa error', async () => { await page.evaluate(x => { if (document.getElementById(x)) setActiveView(x); }, v); await wait(600); });

  console.log('\nOverview: rencana, kalender, papan');
  await t('buat ide, geser tanggal, pindah status', async () => {
    const r = await page.evaluate(async () => { const it = cpNew({ charId: 'c1', title: 'Tes ide', date: ymd(new Date()) }); await cpSave(it); it.date = '2030-01-05'; await cpSave(it); await cpSetStatus(it, 'siap'); const g = await idbGet('drafts', it.id); return [g.date, g.status]; });
    eq(r, ['2030-01-05', 'siap']); });
  await t('status terposting mengisi tanggal dan menandai aset', async () => {
    const r = await page.evaluate(async (a) => { const it = cpNew({ charId: 'c1', title: 'Posting', assetIds: [a] }); await cpSave(it); await cpSetStatus(it, 'terposting'); const g = await idbGet('drafts', it.id); const as = await idbGet('assets', a); return [!!g.date, as.meta.status]; }, ids[0]);
    eq(r, [true, 'posted']); });
  await t('Overview menggambar kalender, papan, performa', async () => {
    await page.evaluate(() => { OV.tab = 'kalender'; setActiveView('v-overview'); renderOverview(); }); await wait(700); ok(await page.$('.cpgrid'), 'kalender');
    await page.click('[data-ovtab="papan"]'); await wait(400); ok((await page.$$('.cpcol')).length === 4, '4 kolom');
    await page.click('[data-ovtab="performa"]'); await wait(400); ok(await page.$('#pfSum'), 'ringkasan performa'); });
  await t('rencana contoh masuk kalender', async () => {
    await page.click('[data-ovtab="rencana"]'); await wait(300); const n0 = await page.evaluate(async () => (await cpAll()).length);
    await page.click('#cpSample'); await wait(700); eq(await page.evaluate(async () => (await cpAll()).length), n0 + 4); });
  await t('performa: ER dihitung benar', async () => { eq(await page.evaluate(() => [pfEr({ perf: { views: 1000, likes: 80, comments: 10, shares: 10 } }), pfEr({ perf: {} })]), [10, null]); });
  await t('AI trend, jam, momen tersimpan (AI tiruan)', async () => {
    await page.evaluate(() => { window.callText = async (p, pr) => /momen/.test(pr) ? '[{"date":"2099-01-01","name":"M","idea":"i"}]' : /jam posting/.test(pr) ? '[{"plat":"Instagram","slots":"19.00","note":"n"}]' : '[{"title":"T","format":"video","level":"Tinggi","why":"w","idea":"i"}]'; });
    await page.evaluate(() => { OV.tab = 'kalender'; renderOverview(); }); await wait(600);
    await page.fill('#tnNiche', 'kuliner'); await page.click('#tnGo'); await wait(600); await page.click('#tmGo'); await wait(600); await page.click('#moGo'); await wait(600);
    const r = await page.evaluate(async () => [!!(await idbGet('drafts', 'ovtrend-c1')), !!(await idbGet('drafts', 'ovtime-c1')), !!(await idbGet('drafts', 'ovmoment'))]); eq(r, [true, true, true]); });
  await t('biaya: tarif, gratis, gagal, tanpa provider', async () => {
    const r = await page.evaluate(() => [jobCost({ status: 'success', provider: 'kie', type: 'image' }), jobCost({ status: 'success', provider: 'gemini', type: 'image' }), jobCost({ status: 'fail', provider: 'kie', type: 'image' }), jobCost({ status: 'success', provider: null, type: 'image' })]);
    eq(r, [0.04, 0, 0, null]); });

  console.log('\nAsset, Portfolio, publik');
  await t('cek wajah menyimpan skor (Gemini tiruan)', async () => {
    const sp = await page.evaluate(async (a) => { const c = await idbGet('characters', 'c1'); c.sourcePhotoAssetId = a; await idbPut('characters', c); window.hasKey = () => true; window.callVisionMulti = async () => '{"score":88,"issues":["x"]}'; return (await fcCheck(a)).score; }, ids[0]);
    eq(sp, 88); });
  await t('orientasi aset terbaca v/h', async () => { eq(await page.evaluate(async (i) => [await assetOrient(await idbGet('assets', i[0])), await assetOrient(await idbGet('assets', i[1]))], ids), ['v', 'h']); });
  await t('Portfolio memisahkan vertikal dan horizontal', async () => {
    await page.evaluate(() => setActiveView('v-portfolio')); await wait(1000);
    eq(await page.evaluate(() => [document.querySelectorAll('#pfGrid .resitem').length > 0, document.querySelectorAll('#pfGridH .resitem').length > 0]), [true, true]); });
  await t('HTML publik: ada bagian horizontal, kartu, tanpa tombol dobel', async () => {
    const h = await page.evaluate(async () => pfBuildHtml({ profile: { brand: 'X' }, heading: 'X', items: await pfCollect(await pfAllPortfolio(), 'export', true), talents: [] }));
    ok((h.match(/<main class="hz">/g) || []).length === 1, 'grid horizontal'); ok((h.match(/<figure/g) || []).length >= 2, 'figure'); });
  await t('paket posting terbuka dan mengunduh', async () => {
    await page.evaluate(async (a) => { postPack({ assetIds: [a], title: 'Tes', caption: 'cap', hashtags: ['a'], platform: 'Instagram', charId: 'c1' }); }, ids[0]); await wait(400);
    const [d] = await Promise.all([page.waitForEvent('download'), page.click('#ppDl')]); ok(/\.png$/.test(d.suggestedFilename()), 'nama file'); await page.evaluate(() => document.querySelector('.modal-bg').remove()); });

  console.log('\nStudio');
  await t('Studio: rencana → Studio mengisi planRef, pil plan hilang', async () => {
    const r = await page.evaluate(async () => { const it = cpNew({ charId: 'c1', title: 'Dari rencana', scene: 'kafe', type: 'photo' }); await cpSave(it); await cpToStudio(it); return [studioState.planRef === it.id, studioState.mode, studioState.scene]; });
    await wait(700); eq(r, [true, 'photo', 'kafe']); ok(!(await page.$('[data-mode="plan"]')), 'pil plan harus hilang'); });
  await t('hasil Studio otomatis menempel ke rencana', async () => {
    const r = await page.evaluate(async () => { const ref = studioState.planRef; const b = await (await fetch(await (async () => { const cv = document.createElement('canvas'); cv.width = 10; cv.height = 10; return cv.toDataURL(); })())).blob(); const id = await putAsset(b, { type: 'studio_image', characterId: 'c1' }); const it = await idbGet('drafts', ref); return [it.assetIds.includes(id), it.status]; });
    eq(r, [true, 'dibuat']); });

  console.log('\nEditor timeline');
  await page.evaluate(async () => { TL.clips = []; TL.tracks = []; TL.undo = []; TL.redo = []; await idbDelete('drafts', 'editor-project'); ED.restored = false; });
  await t('Editor tampil dengan jalur & kanvas', async () => { await page.evaluate(() => setActiveView('v-export')); await wait(900); ok(await page.$('#edBox'), 'kotak preview'); ok((await page.$$('.tllane')).length >= 3, 'jalur'); });
  await t('tambah 2 gambar berurutan, durasi total benar', async () => {
    const r = await page.evaluate(async (ids) => { await tlAddMedia(ids[0]); await tlAddMedia(ids[1]); return [TL.clips.length, tlTotal() > 0, TL.clips[1].start >= tlEnd(TL.clips[0]) - 1e-6]; }, ids); eq(r, [2, true, true]); });
  await t('pecah klip di playhead jadi dua tanpa tumpang tindih', async () => {
    const r = await page.evaluate(async () => { const c = TL.clips[0]; TL.sel = c.id; TL.t = c.start + c.dur / 2; const n = TL.clips.length; await tlSplit(); const a = TL.clips.filter(x => x.track === c.track).sort((p, q) => p.start - q.start); let ov = false; for (let i = 1; i < a.length; i++) if (a[i].start < tlEnd(a[i - 1]) - 1e-6) ov = true; return [TL.clips.length, n + 1, ov]; }); eq(r, [3, 3, false]); });
  await t('trim kiri/kanan dan geser menjaga batas', async () => {
    const r = await page.evaluate(() => { const c = TL.clips[0], o = Object.assign({}, c); tlTrimR(c, o, -0.5); const d1 = c.dur < o.dur; tlTrimL(c, Object.assign({}, c), 0.2); return [d1, c.dur >= TL_MIN, c.start >= 0]; }); eq(r, [true, true, true]); });
  await t('undo & redo mengembalikan jumlah klip', async () => {
    const r = await page.evaluate(async () => { const n = TL.clips.length; await tlDup(); const n2 = TL.clips.length; await tlUndo(); const n3 = TL.clips.length; await tlRedo(); return [n2 === n + 1, n3 === n, TL.clips.length === n2]; }); eq(r, [true, true, true]); });
  await t('teks & audio: tambah teks, ubah properti lewat panel', async () => {
    const r = await page.evaluate(async () => { const c = await tlAddText(); c.text = 'Halo'; await tlAfter(); return [c.kind, TL.tracks.find(t => t.id === c.track).kind]; }); eq(r, ['text', 'text']); await wait(300); ok(await page.$('#pText'), 'panel teks'); });
  await t('timeline tersimpan & pulih setelah muat ulang state', async () => {
    const r = await page.evaluate(async () => { await tlSaveNow(); const n = TL.clips.length; TL.clips = []; TL.tracks = []; ED.restored = false; await tlRestore(); return [n > 0, TL.clips.length === n]; }); eq(r, [true, true]); });
  await t('migrasi project editor lama (v1) ke timeline', async () => {
    const r = await page.evaluate(async (ids) => { await idbPut('drafts', { id: 'editor-project', clips: [{ id: 'k1', assetId: ids[0], kind: 'image', dur: 2, text: 'Judul lama', pos: 'top', size: 6, color: '#fff' }, { id: 'k2', assetId: ids[1], kind: 'image', dur: 3, text: '', pos: 'bottom', size: 6, color: '#fff' }], ratio: '1:1' }); ED.restored = false; TL.clips = []; TL.tracks = []; await tlRestore(); return [TL.clips.filter(c => c.kind === 'image').length, TL.clips.filter(c => c.kind === 'text').length, TL.ratio, !!(await idbGet('drafts', 'editor-project-v1'))]; }, ids); eq(r, [2, 1, '1:1', true]); });
  await t('ekspor satu gambar menghasilkan aset baru', async () => {
    await page.evaluate(async (ids) => { TL.clips = []; TL.tracks = tlDefaultTracks(); await tlAddMedia(ids[0]); setActiveView('v-export'); await renderExport(); }, ids); await wait(700);
    const n0 = await page.evaluate(async () => (await idbGetAll('assets')).length); await page.click('.tltab[data-tab="exp"]'); await page.click('#edExport'); await wait(1800);
    eq(await page.evaluate(async () => (await idbGetAll('assets')).length), n0 + 1); });
  await t('ekspor video multi-klip direkam (>0 byte)', async () => {
    await page.evaluate(async (ids) => { TL.clips = []; TL.tracks = tlDefaultTracks(); const a = await tlAddMedia(ids[0]); a.dur = 0.8; const b = await tlAddMedia(ids[1]); b.dur = 0.8; await tlAfter(); }, ids);
    const r = await page.evaluate(async () => { const out = await tlRun({ record: true }); return out ? out.blob.size : 0; }); ok(r > 500, 'ukuran ' + r); });
  await t('pintasan: Spasi tidak error & S memecah', async () => {
    await page.evaluate(async (ids) => { TL.clips = []; TL.tracks = tlDefaultTracks(); const c = await tlAddMedia(ids[0]); c.dur = 4; TL.sel = c.id; TL.t = 2; await tlAfter(); }, ids);
    await page.evaluate(() => document.activeElement && document.activeElement.blur()); await page.keyboard.press('s'); await wait(400);
    eq(await page.evaluate(() => TL.clips.length), 2); });

  console.log('\nEditor tahap 2');
  await t('stiker masuk sebagai klip teks emoji', async () => {
    await page.evaluate(async (ids) => { TL.clips = []; TL.tracks = tlDefaultTracks(); await tlAddMedia(ids[0]); }, ids);
    const r = await page.evaluate(async () => { const c = await tlAddSticker('🔥'); return [c.kind, c.sticker, c.text]; }); eq(r, ['text', true, '🔥']); });
  await t('teks otomatis dari naskah membagi kalimat sepanjang video', async () => {
    const r = await page.evaluate(async (ids) => { const a = await idbGet('assets', ids[0]); a.meta.script = 'Halo semua. Ini kalimat kedua! Dan yang ketiga?'; await idbPut('assets', a); const n0 = TL.clips.length; const n = await tlAutoText(); return [n, TL.clips.length - n0, TL.clips.filter(c => c.text && /ketiga/.test(c.text)).length]; }, ids); eq(r, [3, 3, 1]); });
  await t('transisi: progres 0→1 dan efek tidak error saat digambar', async () => {
    const r = await page.evaluate(async () => { const c = TL.clips.find(x => x.kind === 'image'); c.tr = 'slide'; c.trD = 1; const k0 = tlTrK(c, c.start), k1 = tlTrK(c, c.start + 0.5), k2 = tlTrK(c, c.start + 2); for (const m of ['fade', 'slide', 'zoom', 'wipe']) { c.tr = m; tlPaint(); TL.t = c.start + 0.2; tlPaint(); } return [k0, k1 > 0 && k1 < 1, k2]; }); eq(r, [0, true, 1]); });
  await t('panel properti menampilkan transisi dan mengubahnya', async () => {
    await page.evaluate(() => { TL.sel = TL.clips.find(x => x.kind === 'image').id; tlRenderProps(); }); await page.click('.tltab[data-tab="props"]'); await page.selectOption('#pTr', 'zoom'); await wait(400);
    eq(await page.evaluate(() => TL.clips.find(x => x.kind === 'image').tr), 'zoom'); });
  await t('gelombang audio: puncak dihitung dari berkas WAV', async () => {
    const r = await page.evaluate(async () => { const sr = 8000, n = sr * 2, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0))); w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true); for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / 20) * 12000, true);
      const c = await tlAddAudio(new File([b], 'tes.wav', { type: 'audio/wav' })); const pk = await tlPeaks(c.assetId); return [pk.length, Math.max(...pk) > 0.2]; }); eq(r, [40, true]); });

  console.log('\nEditor tahap 3: layout & rencana');
  await t('rasio otomatis mengikuti media pertama & kanvas pas tanpa bar', async () => {
    await page.evaluate(async () => { TL.clips = []; TL.tracks = tlDefaultTracks(); setActiveView('v-export'); await renderExport(); }); await wait(500);
    const r = await page.evaluate(async (ids) => { await tlAddMedia(ids[1]); const cv = document.getElementById('edBox'), b = cv.getBoundingClientRect(), st = document.querySelector('.tlstage').getBoundingClientRect(); return [TL.ratio, Math.abs(b.width / b.height - 16 / 9) < 0.03, b.width <= st.width + 1 && b.height <= st.height + 1]; }, ids); eq(r, ['16:9', true, true]); });
  await t('hasil Editor menempel ke rencana konten asal', async () => {
    const r = await page.evaluate(async (ids) => { const it = cpNew({ charId: 'c1', title: 'Rencana edit' }); await cpSave(it); const a = await idbGet('assets', ids[0]); a.meta.planItem = it.id; await idbPut('assets', a); TL.clips = []; TL.tracks = tlDefaultTracks(); await tlAddMedia(ids[0]); await renderExport(); return it.id; }, ids); await wait(500);
    await page.click('.tltab[data-tab="exp"]'); await page.click('#edExport'); await wait(1800);
    eq(await page.evaluate(async (id) => { const g = await idbGet('drafts', id); return [g.assetIds.length, g.status]; }, r), [1, 'dibuat']); });

  await t('ekspor frame-demi-frame (WebCodecs+MP4) menghasilkan file wajar', async () => {
    await page.evaluate(async (ids) => { TL.clips = []; TL.tracks = tlDefaultTracks(); const a = await tlAddMedia(ids[0]); a.dur = 1; const b = await tlAddMedia(ids[1]); b.dur = 1; await tlAfter(); }, ids);
    const r = await page.evaluate(async () => { const o = await tlExportFile(() => {}, { vcodec: 'vp09.00.10.08', acodec: 'opus' }); if (typeof o === 'string') return o; const u8 = new Uint8Array(await o.blob.arrayBuffer()); return [o.blob.type, o.blob.size > 2000, String.fromCharCode(...u8.slice(4, 8)), o.duration]; });
    ok(r !== 'unsupported', 'WebCodecs tidak tersedia di browser uji'); eq(r, ['video/mp4', true, 'ftyp', 2]); });

  await clean(); await browser.close(); srv.close();
  const bad = results.filter(r => !r[1]); console.log('\n' + (results.length - bad.length) + '/' + results.length + ' lulus' + (bad.length ? ', ' + bad.length + ' gagal' : '')); process.exit(bad.length ? 1 : 0);
})();
