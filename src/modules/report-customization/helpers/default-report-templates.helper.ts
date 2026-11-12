import {
  ReportCustomizationType,
  ReportTemplateSection,
} from '../entities/report-customization.entity';

const PHYSICAL_SUB_TYPES = [
  'PD',
  'FI',
  'RCU',
  'Investigation',
  'Mystery Call',
  'Mystery Shopping',
  'Complaint',
] as const;

export const PHYSICAL_REPORT_SUB_TYPES = [...PHYSICAL_SUB_TYPES];

export function defaultReportTitle(
  reportType: ReportCustomizationType,
  physicalSubType?: string | null,
): string {
  switch (reportType) {
    case 'DIGITAL':
      return 'Digital Verification Detailed Report';
    case 'OCR':
      return 'OCR Verification Report';
    case 'TRIANGULATION':
      return 'Triangulation Verification Report';
    case 'PHYSICAL':
      return physicalSubType
        ? `Field Verification Detailed Report — ${physicalSubType}`
        : 'Field Verification Detailed Report';
    default:
      return 'Verification Report';
  }
}

function withOrder(sections: Omit<ReportTemplateSection, 'order'>[]): ReportTemplateSection[] {
  return sections.map((s, index) => ({ ...s, order: index + 1 }));
}

export function getDefaultSections(
  reportType: ReportCustomizationType,
): ReportTemplateSection[] {
  switch (reportType) {
    case 'PHYSICAL':
      return withOrder([
        {
          key: 'caseDetails',
          label: 'Case Details',
          visible: true,
          fields: [
            { key: 'lanNo', label: 'LAN No', visible: true },
            { key: 'state', label: 'State', visible: true },
            { key: 'product', label: 'Product', visible: true },
            { key: 'location', label: 'Location', visible: true },
            { key: 'rcuManagerName', label: 'RCU Manager Name', visible: true },
          ],
        },
        { key: 'applicantDetails', label: 'Applicant Details', visible: true },
        { key: 'coApplicantDetails', label: 'Co-applicant Details', visible: true },
        { key: 'trigger', label: 'Trigger', visible: true },
        { key: 'sampledDocuments', label: 'Sampled Documents Details', visible: true },
        {
          key: 'referNegativeFraud',
          label: 'Refer, Negative & Fraud Reason',
          visible: true,
          fields: [
            { key: 'desktopCheck', label: 'Desktop Check', visible: true },
            { key: 'verifierName', label: 'Verifier Name', visible: true },
            { key: 'deDupeCheck', label: 'De-Dupe Check', visible: true },
            { key: 'neighbourFeedback', label: 'Neighbour Feedback', visible: true },
          ],
        },
        {
          key: 'finalReport',
          label: 'Final Report Details',
          visible: true,
          fields: [
            { key: 'overallStatus', label: 'Overall Status', visible: true },
            { key: 'tat', label: 'TAT', visible: true },
            { key: 'pickUpDate', label: 'Pick-up Date', visible: true },
            { key: 'reportDate', label: 'Report Date', visible: true },
            { key: 'localOrOgl', label: 'Local / OGL', visible: true },
            { key: 'vendorName', label: 'Vendor Name', visible: true },
            { key: 'verifierName', label: 'Verifier Name', visible: true },
          ],
        },
        { key: 'fieldVisitPhotos', label: 'Field Executive Visit Photos', visible: true },
        { key: 'customerCallHistory', label: 'Customer Call History', visible: true },
      ]);

    case 'DIGITAL':
      return withOrder([
        { key: 'inputDetails', label: 'Input Details', visible: true },
        { key: 'personIdentity', label: 'Person Identity', visible: true },
        { key: 'occupationDetails', label: 'Occupation Details', visible: true },
        { key: 'panLinkWithAadhar', label: 'Pan Link With Adhar', visible: true },
        { key: 'kycInfo', label: 'KYC Info', visible: true },
        { key: 'professionalInfo', label: 'Professional Info', visible: true },
        { key: 'financial', label: 'Financial', visible: true },
        { key: 'digitalFootprint', label: 'Digital Footprint', visible: true },
        { key: 'identityIntelligence', label: 'Identity Intelligence', visible: true },
        { key: 'legalInfo', label: 'Legal Info', visible: true },
        { key: 'addressVerification', label: 'Address Verification', visible: true },
        { key: 'ocrUpsell', label: 'OCR Verification Prompt', visible: true },
      ]);

    case 'OCR':
      return withOrder([
        { key: 'requestMeta', label: 'Request Details', visible: true },
        { key: 'documents', label: 'Document Extractions', visible: true },
        { key: 'mergedPdf', label: 'Merged PDF / ZIP', visible: true },
      ]);

    case 'TRIANGULATION':
      return withOrder([
        { key: 'summary', label: 'Triangulation Summary', visible: true },
        { key: 'digitalCrossCheck', label: 'Digital Cross Check', visible: true },
        { key: 'ocrCrossCheck', label: 'OCR Cross Check', visible: true },
        { key: 'physicalCrossCheck', label: 'Physical Cross Check', visible: true },
        { key: 'finalConclusion', label: 'Final Conclusion', visible: true },
      ]);

    default:
      return [];
  }
}

export function buildDefaultTemplatePayload(
  reportType: ReportCustomizationType,
  physicalSubType?: string | null,
) {
  return {
    reportType,
    physicalSubType: reportType === 'PHYSICAL' ? physicalSubType || null : null,
    title: defaultReportTitle(reportType, physicalSubType),
    sections: getDefaultSections(reportType),
    source: 'default' as const,
  };
}
