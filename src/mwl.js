const dcmjsDimse = require('dcmjs-dimse');
const { Client, requests, Dataset } = dcmjsDimse;
const { CFindRequest } = requests;

const MAX_RESULTS = 2000;
const QUERY_TIMEOUT_MS = 20000;
const ABORT_GRACE_MS = 3000;

async function queryWorklist(conn, filters = {}) {
  return new Promise((resolve, reject) => {
    const client = new Client();
    const results = [];
    let settled = false;
    let cancelled = false;
    let timeoutTimer = null;
    let abortTimer = null;

    function stopTimers() {
      clearTimeout(timeoutTimer);
      clearTimeout(abortTimer);
    }

    function cancelQuery() {
      if (cancelled) return;
      cancelled = true;
      client.cancel(request);
      abortTimer = setTimeout(() => client.abort(), ABORT_GRACE_MS);
    }

    const query = new Dataset({
      PatientID: filters.patientId || '',
      PatientName: filters.patientName || '',
      PatientBirthDate: '',
      PatientSex: '',
      AccessionNumber: filters.accessionNumber || '',
      StudyInstanceUID: '',
      RequestedProcedureID: '',
      RequestedProcedureDescription: '',
      ScheduledProcedureStepSequence: [
        {
          Modality: filters.modality || '',
          ScheduledStationAETitle: conn.callingAet || '',
          ScheduledProcedureStepStartDate: filters.scheduledDate || '',
          ScheduledProcedureStepStartTime: '',
          ScheduledProcedureStepDescription: '',
          ScheduledProcedureStepID: '',
          ScheduledPerformingPhysicianName: '',
        },
      ],
      SpecificCharacterSet: 'ISO_IR 192',
    });

    const request = CFindRequest.createWorklistFindRequest(query);

    request.on('response', (response) => {
      if (response.hasDataset()) {
        const ds = response.getDataset();
        const e = ds.elements || ds;
        const item = datasetToPlain(e);
        results.push(item);
        console.log(`[MWL] match #${results.length}: acc=${item.accessionNumber} patient=${item.patientId} sps=${item.scheduledStepId}`);
        if (results.length >= MAX_RESULTS) cancelQuery();
      } else {
        console.log(`[MWL] response with no dataset, status=0x${response.getStatus().toString(16)}`);
      }
    });

    client.addRequest(request);
    client.on('networkError', (err) => {
      if (settled) return;
      settled = true;
      stopTimers();
      reject(err);
    });
    client.on('closed', () => {
      if (settled) return;
      settled = true;
      stopTimers();
      resolve(results);
    });

    timeoutTimer = setTimeout(cancelQuery, QUERY_TIMEOUT_MS);
    client.send(conn.host, parseInt(conn.port), conn.callingAet, conn.calledAet);
  });
}

function str(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return '';
    const first = v[0];
    if (typeof first === 'string') return first;
    if (first && first.Alphabetic !== undefined) return first.Alphabetic;
    return str(first);
  }
  if (v.Alphabetic !== undefined) return v.Alphabetic;
  return String(v);
}

function datasetToPlain(e) {
  const spsRaw = e.ScheduledProcedureStepSequence;
  const spsArr = Array.isArray(spsRaw) ? spsRaw : (spsRaw ? [spsRaw] : []);
  const sps = (spsArr[0] && spsArr[0].elements) ? spsArr[0].elements : (spsArr[0] || {});

  return {
    patientId:            str(e.PatientID),
    patientName:          str(e.PatientName),
    patientBirthDate:     str(e.PatientBirthDate),
    patientSex:           str(e.PatientSex),
    accessionNumber:      str(e.AccessionNumber),
    studyInstanceUid:     str(e.StudyInstanceUID),
    studyDescription:     str(e.RequestedProcedureDescription),
    requestedProcedureId: str(e.RequestedProcedureID),
    modality:             str(sps.Modality),
    scheduledDate:        str(sps.ScheduledProcedureStepStartDate),
    scheduledStepId:      str(sps.ScheduledProcedureStepID),
  };
}

module.exports = { queryWorklist };
