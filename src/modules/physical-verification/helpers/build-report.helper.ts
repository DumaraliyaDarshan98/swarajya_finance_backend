import type {
  PhysicalPartyDetails,
  PhysicalReportPayload,
} from '../interfaces/physical-verification.interface';
import { PhysicalVerification } from '../entities/physical-verification.entity';
import { PhysicalVerificationVisit } from '../entities/physical-verification-visit.entity';
import { visitAddressLabel } from './visit-workflow.helper';

export function buildPhysicalReport(
  record: PhysicalVerification,
  visits: PhysicalVerificationVisit[] = [],
): PhysicalReportPayload {
  const a = record.applicant;
  const sampledDocuments = buildSampledDocuments(record, visits);
  const fieldVisitPhotos = visits.length
    ? buildFieldVisitPhotosFromVisits(visits)
    : buildFieldVisitPhotos(a);

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
    sampledDocuments,
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
    fieldVisitPhotos,
  };
}

function buildSampledDocuments(
  record: PhysicalVerification,
  visits: PhysicalVerificationVisit[],
) {
  const a = record.applicant;
  if (!visits.length) {
    return [
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
    ];
  }

  return visits.map((visit) => {
    const label = visit.addressType === 'RESIDENTIAL' ? 'Residence Profile' : 'Office Profile';
    const submission = visit.fieldAgentSubmission;
    const remark =
      visit.addressType === 'RESIDENTIAL'
        ? submission?.residential?.executiveRemark
        : submission?.office?.executiveRemark;
    return {
      type: label,
      verificationRemark:
        remark?.trim() ||
        `${label.toUpperCase()} - Verified at ${visitAddressLabel(visit)}. Case status marked as Positive.`,
      additionalNote:
        (visit.addressType === 'RESIDENTIAL'
          ? submission?.residential?.additionalNote
          : submission?.office?.additionalNote) ||
        record.completeRemark ||
        'Additional verification notes.',
    };
  });
}

function buildFieldVisitPhotosFromVisits(visits: PhysicalVerificationVisit[]) {
  return visits.map((visit) => {
    const submission = visit.fieldAgentSubmission;
    const geo =
      visit.addressType === 'RESIDENTIAL'
        ? submission?.residential?.addressGeo
        : submission?.office?.addressGeo;
    const photos =
      visit.addressType === 'RESIDENTIAL'
        ? submission?.residential?.photos
        : submission?.office?.photos;

    const photoEntries: { label: string; url: string }[] = [];
    if (photos?.locationSelfie) {
      photoEntries.push({ label: 'Location Selfy Image', url: photos.locationSelfie });
    }
    if (photos?.namePlateSelfie) {
      photoEntries.push({ label: 'Name Plate Selfy Image', url: photos.namePlateSelfie });
    }
    if (photos?.frontView) {
      photoEntries.push({ label: 'Front View image', url: photos.frontView });
    }
    if (photos?.visitingCard) {
      photoEntries.push({ label: 'Visiting Card Image', url: photos.visitingCard });
    }

    return {
      addressType: visit.addressType === 'RESIDENTIAL' ? ('Residential' as const) : ('Office' as const),
      landmarkDetails: geo?.landmarkDetails || visit.addressSnapshot?.landmark || 'Nearby landmark information',
      longitude: geo?.longitude || submission?.agentLocation?.longitude || '—',
      latitude: geo?.latitude || submission?.agentLocation?.latitude || '—',
      googleStreetViewLink: geo?.googleStreetViewLink || 'https://www.google.com/maps/search/',
      lastUpdate: geo?.lastUpdate || String(new Date().getFullYear()),
      photos: photoEntries.length
        ? photoEntries
        : [{ label: 'Location Selfy Image', url: 'assets/img/location-view.png' }],
    };
  });
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
