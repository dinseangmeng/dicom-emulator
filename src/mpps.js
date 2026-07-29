const dcmjsDimse = require('dcmjs-dimse');
const { Client, requests, Dataset } = dcmjsDimse;
const { NCreateRequest, NSetRequest } = requests;
const { generateUID, nowDate, nowTime } = require('./utils');

const MPPS_SOP_CLASS = '1.2.840.10008.3.1.2.3.3';

async function sendMppsInProgress(conn, mppsUid, study) {
  return new Promise((resolve, reject) => {
    const client = new Client();

    const dataset = new Dataset({
      SpecificCharacterSet: 'ISO_IR 192',
      SOPClassUID: MPPS_SOP_CLASS,
      SOPInstanceUID: mppsUid,
      PatientID: study.patientId,
      PatientName: study.patientName,
      PatientBirthDate: study.patientBirthDate || '',
      PatientSex: study.patientSex || '',
      StudyInstanceUID: study.studyInstanceUid,
      PerformedProcedureStepStatus: 'IN PROGRESS',
      PerformedProcedureStepStartDate: nowDate(),
      PerformedProcedureStepStartTime: nowTime(),
      PerformedProcedureStepID: 'MPPS-' + Date.now(),
      PerformedStationAETitle: conn.callingAet,
      PerformedStationName: 'EMULATOR',
      PerformedLocation: '',
      Modality: study.modality || 'CT',
      PerformedProcedureStepDescription: study.studyDescription || '',
      PerformedProtocolCodeSequence: [],
      PerformedSeriesSequence: [],
      ReferencedStudySequence: [],
      AccessionNumber: study.accessionNumber || '',
      RequestedProcedureID: study.requestedProcedureId || '',
      ScheduledStepAttributesSequence: [
        {
          StudyInstanceUID: study.studyInstanceUid,
          AccessionNumber: study.accessionNumber || '',
          RequestedProcedureID: study.requestedProcedureId || '',
          RequestedProcedureDescription: study.studyDescription || '',
          ScheduledProcedureStepID: study.scheduledStepId || '',
          ScheduledProcedureStepDescription: study.studyDescription || '',
          ReferencedStudySequence: [],
        },
      ],
    });

    const request = new NCreateRequest(MPPS_SOP_CLASS, mppsUid);
    request.setDataset(dataset);

    request.on('response', (response) => {
      console.log('[MPPS] IN PROGRESS status:', response.getStatus().toString(16));
    });

    client.addRequest(request);
    client.on('networkError', reject);
    client.on('closed', resolve);
    client.send(conn.host, parseInt(conn.port), conn.callingAet, conn.calledAet);
  });
}

async function sendMppsCompleted(conn, mppsUid, study, seriesUid, sopUids) {
  return new Promise((resolve, reject) => {
    const client = new Client();

    const dataset = new Dataset({
      SpecificCharacterSet: 'ISO_IR 192',
      PerformedProcedureStepStatus: 'COMPLETED',
      PerformedProcedureStepEndDate: nowDate(),
      PerformedProcedureStepEndTime: nowTime(),
      PerformedSeriesSequence: [
        {
          SeriesInstanceUID: seriesUid,
          Modality: study.modality || 'CT',
          SeriesDescription: study.studyDescription || '',
          PerformingPhysicianName: '',
          OperatorsName: '',
          ReferencedImageSequence: sopUids.map((uid) => ({
            ReferencedSOPClassUID: '1.2.840.10008.5.1.4.1.1.2',
            ReferencedSOPInstanceUID: uid,
          })),
          ReferencedNonImageCompositeSOPInstanceSequence: [],
        },
      ],
    });

    const request = new NSetRequest(MPPS_SOP_CLASS, mppsUid);
    request.setDataset(dataset);

    request.on('response', (response) => {
      console.log('[MPPS] COMPLETED status:', response.getStatus().toString(16));
    });

    client.addRequest(request);
    client.on('networkError', reject);
    client.on('closed', resolve);
    client.send(conn.host, parseInt(conn.port), conn.callingAet, conn.calledAet);
  });
}

module.exports = { sendMppsInProgress, sendMppsCompleted };
