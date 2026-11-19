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

  console.log('\nKamera sinematik');
  await t('camPrompt merangkai kalimat & kosong jika tidak dipilih', async () => {
    const r = await page.evaluate(() => [camPrompt({}), camPrompt({ camera: CAM_OPTS.camera[1][0][0], move: CAM_OPTS.move[1][1][0] })]);
    eq(r[0], ''); ok(/^Cinematic camera setup: Modular 8K/.test(r[1]) && /dolly/.test(r[1]), r[1]); });
  await t('prompt film memuat setelan kamera', async () => {
    const r = await page.evaluate(() => { const f = filmNew(); f.cam = { lens: CAM_OPTS.lens[1][0][0], aperture: CAM_OPTS.aperture[1][0][0] }; f.clips[0].prompt = 'Adegan uji'; const a = filmPrompt(f, 0, [], []); f.cam = {}; return [/anamorphic/.test(a), /f\/1\.4/.test(a), /Cinematic camera setup/.test(filmPrompt(f, 0, [], []))]; }); eq(r, [true, true, false]); });
  await t('prompt foto memuat setelan kamera & menandai penggantian kamera lama', async () => {
    const r = await page.evaluate(async () => { const c = (await idbGetAll('characters'))[0]; return studioPhotoPrompt(c, 1, 1, { cam: { focal: CAM_OPTS.focal[1][4][0] } }); }); ok(/50mm portrait/.test(r) && /menggantikan arahan kamera/.test(r), r.slice(-300)); });
  await t('UI kamera sinematik tampil di Studio Foto dan Film', async () => {
    await page.evaluate(() => { studioState.mode = 'photo'; setActiveView('v-studio'); }); await wait(900); ok(await page.$('#v-studio select[data-cam="lens"]'), 'foto');
    await page.evaluate(() => { studioState.mode = 'film'; renderStudio(); }); await wait(900); ok(await page.$('#v-studio select[data-cam="move"]'), 'film'); });

  console.log('\nSeedance');
  await t('seedanceInput: frame awal & mode lanjut', async () => {
    const r = await page.evaluate(async () => { const old = kieUpload; kieUpload = async (k, d) => 'u:' + String(d).slice(0, 10);
      const a = await seedanceInput('k', 'bytedance/seedance-2-5', { prompt: 'x', src: 'data:image/png;base64,AA', dur: 10, sound: true, ar: '9:16', res: '360p' });
      const b = await seedanceInput('k', 'bytedance/seedance-2-5', { prompt: 'y', extendSrc: 'data:video/mp4;base64,AA', dur: 8, sound: true, res: '720p' });
      let e = ''; try { await seedanceInput('k', 'bytedance/seedance-2', { prompt: 'z', extendSrc: 'data:video/mp4;base64,AA', dur: 5 }); } catch (x) { e = x.message; }
      kieUpload = old; return [a, b, e]; });
    eq(r[0].resolution, '480p'); eq(r[0].generate_audio, true); ok(r[0].first_frame_url && r[0].aspect_ratio === '9:16');
    eq(r[1].omni_reference_task_type, 'extend'); eq(r[1].aspect_ratio, 'adaptive'); eq(r[1].reference_video_urls.length, 1); ok(/Seedance 2\.5/.test(r[2])); });
  await t('UI Film: pilihan model Seedance & tombol lanjutkan', async () => {
    const r = await page.evaluate(async () => { studioState.mode = 'film'; renderStudio(); await new Promise(r => setTimeout(r, 900)); return !!document.querySelector('#fVm option[value="bytedance/seedance-2-5"]'); }); ok(r); });

  console.log('\nAlat foto');
  await t('photoTool membuat aset baru dari foto (Kie di-stub) tanpa mengubah aslinya', async () => {
    const r = await page.evaluate(async (ids) => {
      const kieU = kieUpload, kieJ = callKieJob, wk = withKeyRotation; const calls = [];
      kieUpload = async () => 'https://x/y.png'; callKieJob = async (c, k, model, input) => { calls.push([model, input]); const cv = document.createElement('canvas'); cv.width = 20; cv.height = 20; return await new Promise(r => cv.toBlob(r)); }; withKeyRotation = async (id, fn) => fn('K', {});
      const n0 = (await idbGetAll('assets')).length; const nid = await photoTool(ids[0], 'up4'); const nid2 = await photoTool(ids[0], 'bg');
      kieUpload = kieU; callKieJob = kieJ; withKeyRotation = wk;
      const a = await idbGet('assets', nid); return [(await idbGetAll('assets')).length - n0, calls[0][0], calls[0][1].upscale_factor, calls[1][0], !!calls[1][1].image, a.meta.sourceAssetIds[0] === ids[0], /4x/.test(a.meta.title)]; }, ids);
    eq(r, [2, 'topaz/image-upscale', '4', 'recraft/remove-background', true, true, true]); });

  await t('photoTool: perluas rasio & ganti outfit memanggil model yang benar', async () => {
    const r = await page.evaluate(async (ids) => {
      const kieU = kieUpload, kieJ = callKieJob, wk = withKeyRotation; const calls = [];
      kieUpload = async (k, d) => 'https://x/' + String(d).slice(-3); callKieJob = async (c, k, model, input) => { calls.push([model, input]); const cv = document.createElement('canvas'); cv.width = 20; cv.height = 20; return await new Promise(r => cv.toBlob(r)); }; withKeyRotation = async (p, fn) => fn('k', getCfg('kie'));
      const n1 = await photoTool(ids[0], 'rf', null, { size: 'landscape_16_9' }); const n2 = await photoTool(ids[0], 'tryon', null, { garment: 'data:image/png;base64,ZZZ' });
      kieUpload = kieU; callKieJob = kieJ; withKeyRotation = wk;
      return [!!n1, !!n2, calls[0][0], calls[0][1].image_size, /nano-banana-edit/.test(calls[1][0]), calls[1][1].image_urls.length, /garment/.test(calls[1][1].prompt)]; }, ids);
    eq(r, [true, true, 'ideogram/v3-reframe', 'landscape_16_9', true, 2, true]); });
  await t('UI detail aset: tombol Perluas rasio & Ganti outfit', async () => {
    const r = await page.evaluate(async (ids) => { showAssetDetail(ids[0]); await new Promise(r => setTimeout(r, 700)); const o = [!!document.querySelector('#dRf'), !!document.querySelector('#dTry'), !!document.querySelector('#dRfS')]; document.querySelector('#dClose').click(); return o; }, ids);
    eq(r, [true, true, true]); });

  console.log('\nAlat video');
  await t('videoTool memanggil model Kie yang benar (stub)', async () => {
    const r = await page.evaluate(async () => {
      const kieU = kieUpload, kieJ = callKieJob, wk = withKeyRotation, calls = [];
      const cv = document.createElement('canvas'); cv.width = 20; cv.height = 20; const vb = await new Promise(r => cv.toBlob(r));
      const vid = await putAsset(vb, { type: 'studio_video', title: 'V uji', status: 'draft' });
      kieUpload = async (k, d) => 'https://x/' + calls.length; callKieJob = async (c, k, model, input) => { calls.push([model, input]); return vb; }; withKeyRotation = async (p, fn) => fn('k', getCfg('kie'));
      const a = await videoTool(vid, 'motion', null, 'data:image/png;base64,AA'), b = await videoTool(vid, 'replace', null, 'data:image/png;base64,AA'), c = await videoTool(vid, 'lipsync', null, 'data:audio/mpeg;base64,AA');
      kieUpload = kieU; callKieJob = kieJ; withKeyRotation = wk;
      return [!!a && !!b && !!c, calls.map(x => x[0]), Object.keys(calls[0][1]).sort().join()]; });
    eq(r[0], true); eq(r[1], ['kling-3.0/motion-control', 'wan/2-2-animate-replace', 'volcengine/video-to-video-lip-sync']); ok(/input_urls/.test(r[2]) && /video_urls/.test(r[2])); });
  await t('tombol Cari highlight ada di Editor', async () => {
    const r = await page.evaluate(async () => { setActiveView('v-export'); await new Promise(r => setTimeout(r, 900)); return !!document.querySelector('#tHl'); }); ok(r); });

  console.log('\nAkun & sinkron konfigurasi (server tiruan)');
  await t('tanpa API: aplikasi tetap lokal, tanpa layar login', async () => {
    const r = await page.evaluate(() => [CLOUD.on, !!document.getElementById('cloudLogin')]); eq(r, [false, false]); });
  await t('login, tarik konfigurasi dari server, dorong perubahan, keluar', async () => {
    const ctx2 = await browser.newContext({ viewport: { width: 1366, height: 900 } }); const p2 = await ctx2.newPage(); const e2 = []; p2.on('pageerror', e => e2.push(e.message)); p2.on('dialog', d => d.accept());
    let loggedIn = false; const puts = []; const J = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const cfg = { ts: 5000000000000, profile: { id: 'user-profile', displayName: 'Husein Uji', accountType: 'Kreator', role: 'Owner' }, data: { cf_keys: JSON.stringify([{ id: 'k1', provider: 'kie', label: 'Kie', model: '', key: 'KIE-SERVER-KEY', status: 'active', limitUntil: 0 }]) } };
    await p2.route('**/api/**', async (route) => { const u = new URL(route.request().url()), m = route.request().method();
      if (u.pathname === '/api/me') return loggedIn ? J(route, 200, { user: { id: 'u1', email: 'a@b.co', name: 'A', role: 'owner' } }) : J(route, 401, { error: 'Belum masuk.' });
      if (u.pathname === '/api/login') { const b = JSON.parse(route.request().postData()); if (b.password !== 'kata-sandi-benar') return J(route, 401, { error: 'Email atau kata sandi salah.' }); loggedIn = true; return J(route, 200, { user: { id: 'u1', email: 'a@b.co', name: 'A', role: 'owner' } }); }
      if (u.pathname === '/api/keys' && m === 'GET') return J(route, 200, { keys: { config: cfg } });
      if (u.pathname === '/api/keys' && m === 'PUT') { puts.push(JSON.parse(route.request().postData())); return J(route, 200, { ok: true }); }
      if (u.pathname === '/api/logout') { loggedIn = false; return J(route, 200, { ok: true }); }
      return J(route, 404, { error: 'x' }); });
    await p2.goto(url); await p2.waitForSelector('#cloudLogin', { timeout: 8000 });
    await p2.fill('#clE', 'a@b.co'); await p2.fill('#clP', 'salah-salah-1'); await p2.click('#clGo'); await p2.waitForFunction(() => /salah/i.test(document.getElementById('clErr').textContent), null, { timeout: 5000 });
    await p2.fill('#clP', 'kata-sandi-benar'); await p2.click('#clGo');
    await p2.waitForFunction(() => !document.getElementById('cloudLogin') && typeof CLOUD !== 'undefined' && CLOUD.on && !!CLOUD.user && typeof KEYREG !== 'undefined' && KEYREG.some(k => k.key === 'KIE-SERVER-KEY'), null, { timeout: 10000 });
    eq(await p2.evaluate(() => CLOUD.on && CLOUD.user.email), 'a@b.co');
    eq(await p2.evaluate(async () => (await upGet()).displayName), 'Husein Uji', 'profil dari server dipakai');
    puts.length = 0;
    await p2.evaluate(async () => { const u = await upGet(); u.displayName = 'Nama Baru'; await idbPut('drafts', u); });
    for (let i = 0; i < 30 && !puts.some(x => /Nama Baru/.test(JSON.stringify(x))); i++) await p2.waitForTimeout(300);
    ok(puts.some(x => x.value && x.value.profile && x.value.profile.displayName === 'Nama Baru' && x.value.profile.avatarId === undefined), 'perubahan profil terdorong ke server tanpa foto');
    await p2.evaluate(() => { KEYREG.push({ id: 'k2', provider: 'groq', label: 'Groq', model: '', key: 'GROQ-NEW', status: 'active', limitUntil: 0 }); krSave(); });
    for (let i = 0; i < 30 && !puts.some(x => /GROQ-NEW/.test(JSON.stringify(x))); i++) await p2.waitForTimeout(300);
    ok(puts.length >= 1 && puts[puts.length - 1].provider === 'config' && /GROQ-NEW/.test(puts[puts.length - 1].value.data.cf_keys), 'perubahan key harus terdorong ke server');
    await p2.evaluate(() => { setActiveView('v-settings'); }); await p2.waitForTimeout(500);
    await p2.evaluate(() => { const b = [...document.querySelectorAll('#v-settings .subtab')].find(x => /Tentang/.test(x.textContent)); if (b) b.click(); }); await p2.waitForTimeout(900);
    ok(await p2.evaluate(() => !!document.getElementById('clOut') && !!document.getElementById('clInv')), 'kartu akun (owner) tampil di Tentang');
    await p2.evaluate(() => { document.getElementById('clOut').click(); }); await p2.waitForSelector('#cloudLogin', { timeout: 8000 });
    eq(await p2.evaluate(() => localStorage.getItem('cf_keys')), null, 'key lokal dihapus saat keluar');
    ok(e2.length === 0, 'galat halaman: ' + e2.join(' | ')); await ctx2.close(); });

  await t('daftar kreator: layar menunggu persetujuan', async () => {
    const ctx3 = await browser.newContext({ viewport: { width: 1366, height: 900 } }); const p3 = await ctx3.newPage(); const e3 = []; p3.on('pageerror', e => e3.push(e.message));
    const J = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }); let reg = null;
    await p3.route('**/api/**', async (route) => { const u = new URL(route.request().url());
      if (u.pathname === '/api/me') return J(route, reg ? 200 : 401, reg ? { user: reg } : { error: 'x' });
      if (u.pathname === '/api/register') { const b = JSON.parse(route.request().postData()); reg = { id: 'u9', email: b.email, name: b.name, role: 'member', kind: b.kind, status: b.kind === 'kreator' ? 'pending' : 'active', tier: 'gratis', can: {} }; return J(route, 201, { user: reg }); }
      if (u.pathname === '/api/keys') return J(route, 200, { keys: {} });
      return J(route, 404, { error: 'x' }); });
    await p3.goto(url); await p3.waitForSelector('#cloudLogin', { timeout: 8000 });
    await p3.click('#clSw'); await p3.waitForSelector('#clK');
    await p3.fill('#clE', 'c@x.co'); await p3.fill('#clP', 'kata-sandi-panjang'); await p3.selectOption('#clK', 'kreator'); await p3.click('#clGo');
    await p3.waitForSelector('#clOk', { timeout: 5000 }); ok(await p3.evaluate(() => /menunggu persetujuan/i.test(document.getElementById('cloudLogin').textContent)), 'pesan menunggu persetujuan');
    await p3.click('#clOk'); await p3.waitForFunction(() => !document.getElementById('cloudLogin') && CLOUD.user && CLOUD.user.status === 'pending', null, { timeout: 8000 });
    ok(e3.length === 0, 'galat halaman: ' + e3.join(' | ')); await ctx3.close(); });
  await t('Halaman Admin: daftar akun, setujui kreator, ubah tier', async () => {
    const ctx4 = await browser.newContext({ viewport: { width: 1366, height: 900 } }); const p4 = await ctx4.newPage(); const e4 = []; p4.on('pageerror', e => e4.push(e.message));
    const J = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }); const posts = [];
    const users = [{ id: 'o', email: 'own@x.co', name: 'Own', role: 'owner', kind: 'kreator', status: 'active', tier: 'pro', charLimit: null, createdAt: 1 }, { id: 'c1', email: 'kre@x.co', name: 'Kre', role: 'member', kind: 'kreator', status: 'pending', tier: 'gratis', charLimit: null, createdAt: 2 }];
    await p4.route('**/api/**', async (route) => { const u = new URL(route.request().url()), m = route.request().method();
      if (u.pathname === '/api/me') return J(route, 200, { user: { id: 'o', email: 'own@x.co', name: 'Own', role: 'owner', kind: 'kreator', status: 'active', tier: 'pro', can: { admin: true } } });
      if (u.pathname === '/api/keys') return J(route, 200, { keys: {} });
      if (u.pathname === '/api/admin' && m === 'GET') return J(route, 200, { users });
      if (u.pathname === '/api/admin' && m === 'POST') { const b = JSON.parse(route.request().postData()); posts.push(b); Object.assign(users[1], b); return J(route, 200, { ok: true }); }
      return J(route, 404, { error: 'x' }); });
    await p4.goto(url); await p4.waitForFunction(() => typeof CLOUD !== 'undefined' && CLOUD.user, null, { timeout: 8000 }); await p4.waitForTimeout(1500);
    await p4.evaluate(() => setActiveView('v-settings')); await p4.waitForSelector('#v-settings .subtab[data-sub="settingsAdminBody"]', { timeout: 5000 });
    await p4.click('#v-settings .subtab[data-sub="settingsAdminBody"]'); await p4.waitForSelector('[data-ok="c1"]', { timeout: 5000 });
    await p4.click('[data-ok="c1"]'); await p4.waitForFunction(() => !document.querySelector('[data-ok="c1"]'), null, { timeout: 5000 });
    eq(posts[0], { id: 'c1', status: 'active' }, 'persetujuan terkirim');
    await p4.selectOption('select[data-f="tier"][data-id="c1"]', 'pro'); await p4.waitForTimeout(400); eq(posts[1], { id: 'c1', tier: 'pro' });
    await p4.fill('input[data-f="charLimit"][data-id="c1"]', '8'); await p4.dispatchEvent('input[data-f="charLimit"][data-id="c1"]', 'change'); await p4.waitForTimeout(400); eq(posts[2], { id: 'c1', charLimit: 8 });
    ok(e4.length === 0, 'galat halaman: ' + e4.join(' | ')); await ctx4.close(); });

  await clean(); await browser.close(); srv.close();
  const bad = results.filter(r => !r[1]); console.log('\n' + (results.length - bad.length) + '/' + results.length + ' lulus' + (bad.length ? ', ' + bad.length + ' gagal' : '')); process.exit(bad.length ? 1 : 0);
})();
