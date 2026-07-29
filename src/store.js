const dcmjsDimse = require('dcmjs-dimse');
const { Client, requests, Dataset } = dcmjsDimse;
const { CStoreRequest } = requests;
const { nowDate, nowTime } = require('./utils');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function storeOne(conn, study, seriesUid, sopUid, instanceNum, dcmPath) {
  return new Promise((resolve, reject) => {
    if (!dcmPath || !fs.existsSync(dcmPath)) {
      return reject(new Error(`File not found: ${dcmPath}`));
    }

    let patchedPath;
    try {
      const original = Dataset.fromFile(dcmPath);
      const e = original.elements;

      e.SOPInstanceUID    = sopUid;
      e.StudyInstanceUID  = study.studyInstanceUid;
      e.SeriesInstanceUID = seriesUid;
      e.SeriesNumber      = '1';
      e.InstanceNumber    = String(instanceNum);
      e.PatientID         = study.patientId || '';
      e.PatientName       = study.patientName || '';
      e.PatientBirthDate  = study.patientBirthDate || '';
      e.PatientSex        = study.patientSex || '';
      e.AccessionNumber   = study.accessionNumber || '';
      e.StudyDescription  = study.studyDescription || '';
      e.StudyDate         = nowDate();
      e.StudyTime         = nowTime();
      e.ContentDate       = nowDate();
      e.ContentTime       = nowTime();
      e.SeriesDate        = nowDate();
      e.SeriesTime        = nowTime();

      patchedPath = path.join(os.tmpdir(), `dcm_patch_${Date.now()}_${instanceNum}.dcm`);
      original.toFile(patchedPath);
    } catch (err) {
      return reject(new Error(`Failed to patch ${dcmPath}: ${err.message}`));
    }

    const client = new Client();
    const request = new CStoreRequest(patchedPath);

    request.on('response', (response) => {
      console.log(`[STORE] #${instanceNum} status: 0x${response.getStatus().toString(16)}`);
      try { fs.unlinkSync(patchedPath); } catch {}
    });

    client.addRequest(request);

    client.on('networkError', (err) => {
      try { fs.unlinkSync(patchedPath); } catch {}
      reject(err);
    });

    client.on('closed', () => {
      resolve();
    });

    client.send(conn.host, parseInt(conn.port), conn.callingAet, conn.calledAet);
  });
}

module.exports = { storeOne };
