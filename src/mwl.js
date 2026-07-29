const dcmjsDimse = require('dcmjs-dimse');
const { Client, requests, Dataset } = dcmjsDimse;
const { CFindRequest } = requests;

async function queryWorklist(conn, filters = {}) {
  return new Promise((resolve, reject) => {
    const client = new Client();
    const results = [];

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
        results.push(datasetToPlain(e));
      }
    });

    client.addRequest(request);
    client.on('networkError', (err) => reject(err));
    client.on('closed', () => resolve(results));
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
