import type {
  PhysicalPartyDetails,
  PhysicalReportPayload,
} from '../interfaces/physical-verification.interface';
import { PhysicalVerification } from '../entities/physical-verification.entity';

export function buildPhysicalReport(record: PhysicalVerification): PhysicalReportPayload {
  const a = record.applicant;
  return {
    caseDetails: {
      lanNo: a.agreementNumber || record.agreementNumber || '—',
      state: a.residential?.state || 'Maharashtra',
      product: a.product || record.product || 'HL',
      location: a.residential?.city || record.city || 'Mumbai',
      rcuManagerName: 'RCU Manager',
    },
    trigger:
      record.completeRemark?.trim() ||
      `Visited ${a.customerName} for physical verification.`,
    sampledDocuments: [
      {
        type: 'Residence Profile',
        verificationRemark: `RESIDENCE PROFILE - Visited ${a.customerName} at ${a.residential?.address || 'N/A'}. Case status marked as Positive.`,
        additionalNote: record.completeRemark || 'Additional verification notes.',
      },
      {
        type: 'Office Profile',
        verificationRemark: `OFFICE PROFILE - Verified office address at ${a.office?.address || 'N/A'}.`,
        additionalNote: 'Office verification completed.',
      },
      {
        type: 'Salary Slip',
        verificationRemark: 'Salary slip verified and matched with application.',
        additionalNote: 'Document authenticity confirmed.',
      },
    ],
    referNegativeFraud: {
      desktopCheck: 'Done',
      verifierName: 'Field Verifier',
      deDupeCheck: 'Yes',
      neighbourFeedback: 'Positive',
    },
    finalReport: {
      overallStatus: 'POSITIVE',
      tat: '0',
      pickUpDate: new Date().toLocaleDateString('en-GB'),
      reportDate: new Date().toLocaleDateString('en-GB'),
      localOrOgl: 'Local',
      vendorName: 'Extreme Financial Services Pvt.Ltd.',
      verifierName: 'Field Verifier',
    },
    fieldVisitPhotos: buildFieldVisitPhotos(a),
  };
}

function buildFieldVisitPhotos(a: PhysicalPartyDetails) {
  const sets: PhysicalReportPayload['fieldVisitPhotos'] = [];
  if (a.hasResidentialAddress) {
    sets.push({
      addressType: 'Residential',
      landmarkDetails: a.residential?.landmark || 'Nearby landmark information',
      longitude: 'LOG123456789',
      latitude: 'LAT1324658798',
      googleStreetViewLink: 'https://www.google.com/maps/search/',
      lastUpdate: String(new Date().getFullYear()),
      photos: [
        { label: 'Location Selfy Image', url: 'assets/img/location-view.png' },
        { label: 'Name Plate Selfy Image', url: 'assets/img/name-plate-view.png' },
        { label: 'Front View image', url: 'assets/img/fornt-view.png' },
      ],
    });
  }
  if (a.hasOfficeAddress) {
    sets.push({
      addressType: 'Office',
      landmarkDetails: a.office?.landmark || 'Nearby landmark information',
      longitude: 'LOG123456789',
      latitude: 'LAT1324658798',
      googleStreetViewLink: 'https://www.google.com/maps/search/',
      lastUpdate: String(new Date().getFullYear()),
      photos: [
        { label: 'Location Selfy Image', url: 'assets/img/location-view.png' },
        { label: 'Visiting Card Image', url: 'assets/img/photos/stree-view3.jpeg' },
      ],
    });
  }
  return sets;
}
