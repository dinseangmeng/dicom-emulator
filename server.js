const express = require('express');
const path = require('path');
const fs = require('fs');
const { Dataset } = require('dcmjs-dimse');
const { queryWorklist } = require('./src/mwl');
const { sendMppsInProgress, sendMppsCompleted } = require('./src/mpps');
const { storeOne } = require('./src/store');
const { generateUID } = require('./src/utils');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SAMPLES_DIR = path.join(__dirname, 'samples');

function findDcmFiles(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      results = results.concat(findDcmFiles(full));
    } else if (entry.toLowerCase().endsWith('.dcm')) {
      results.push(full);
    }
  }
  return results.sort();
}

function loadFolders() {
  if (!fs.existsSync(SAMPLES_DIR)) return [];
  return fs.readdirSync(SAMPLES_DIR)
    .filter(name => fs.statSync(path.join(SAMPLES_DIR, name)).isDirectory())
    .map(folder => {
      const files = findDcmFiles(path.join(SAMPLES_DIR, folder));
      return { folder, count: files.length, files };
    })
    .filter(f => f.count > 0);
}

const sseClients = new Set();
function emit(type, data) {
  const msg = `data: ${JSON.stringify({ type, ...data })}\n\n`;
  sseClients.forEach(r => r.write(msg));
}
function log(level, msg) {
  emit('log', { level, msg });
  console.log(`[${level.toUpperCase()}] ${msg}`);
}

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

app.get('/api/folders', (req, res) => {
  res.json({ folders: loadFolders() });
});

app.post('/api/worklist', async (req, res) => {
  const { conn, filters = {} } = req.body;
  const c = { host: conn.host, port: conn.port, callingAet: conn.callingAet, calledAet: conn.aet };
  try {
    const items = await queryWorklist(c, filters);
    res.json({ ok: true, items });
  } catch (err) {
    res.json({ ok: false, error: err.message || String(err) });
  }
});

function sortByInstanceNumber(files) {
  const parsed = files.map(f => {
    let instanceNum = Infinity;
    try {
      const ds = Dataset.fromFile(f, undefined, { untilTag: '00200013', includeUntilTagValue: true });
      const e = ds.elements || ds;
      const val = e.InstanceNumber;
      if (val !== undefined && val !== null && val !== '') {
        instanceNum = parseInt(String(val).trim(), 10) || Infinity;
      }
    } catch {}
    return { f, instanceNum };
  });
  parsed.sort((a, b) => a.instanceNum - b.instanceNum);
  return parsed.map(x => x.f);
}

app.post('/api/emulate', async (req, res) => {
  res.json({ ok: true });
  const { connMpps, connStore, study, folder } = req.body;

  const mppsConn  = { host: connMpps.host,  port: connMpps.port,  callingAet: connMpps.callingAet,  calledAet: connMpps.aet };
  const storeConn = { host: connStore.host, port: connStore.port, callingAet: connStore.callingAet, calledAet: connStore.aet };

  const folderEntry = loadFolders().find(f => f.folder === folder);
  if (!folderEntry) {
    log('error', `Folder not found: ${folder}`);
    emit('done', { ok: false });
    return;
  }

  // Sort files by InstanceNumber tag inside the DCM file
  const dcmFiles = sortByInstanceNumber(folderEntry.files);

  const mppsUid   = generateUID();
  const seriesUid = generateUID();
  const sopUids   = dcmFiles.map(() => generateUID());
  study.studyInstanceUid = study.studyInstanceUid || generateUID();

  emit('start', {});

  try {
    log('info', `Patient  : ${study.patientName} (${study.patientId})`);
    log('info', `Accession: ${study.accessionNumber}`);
    log('info', `Folder   : ${folder} (${dcmFiles.length} files)`);
    log('info', `MPPS  → ${mppsConn.host}:${mppsConn.port} [${mppsConn.calledAet}]`);
    log('info', `STORE → ${storeConn.host}:${storeConn.port} [${storeConn.calledAet}]`);

    emit('step', { step: 1 });
    log('info', '[MPPS] Sending N-CREATE IN PROGRESS...');
    await sendMppsInProgress(mppsConn, mppsUid, study);
    log('success', '[MPPS] IN PROGRESS sent ✓');

    emit('step', { step: 2 });
    log('info', `[STORE] Sending ${dcmFiles.length} instance(s)...`);
    for (let i = 0; i < dcmFiles.length; i++) {
      await storeOne(storeConn, study, seriesUid, sopUids[i], i + 1, dcmFiles[i]);
      log('success', `[STORE] ${path.basename(dcmFiles[i])} (${i + 1}/${dcmFiles.length}) ✓`);
      emit('progress', { current: i + 1, total: dcmFiles.length });
    }

    emit('step', { step: 3 });
    log('info', '[MPPS] Sending N-SET COMPLETED...');
    await sendMppsCompleted(mppsConn, mppsUid, study, seriesUid, sopUids);
    log('success', '[MPPS] COMPLETED sent ✓');

    emit('done', { ok: true });
  } catch (err) {
    log('error', 'Error: ' + (err.message || String(err)));
    emit('done', { ok: false });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
