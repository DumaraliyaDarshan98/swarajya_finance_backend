export type PhysicalVerificationStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'PARTIAL_ASSIGNED'
  | 'ASSIGNED'
  | 'AGENT_ASSIGNED'
  | 'AGENT_DRAFT'
  | 'AGENT_SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'REPORT_GENERATED'
  | 'FAILED';

export type { FieldAgentSubmission } from './field-agent-submission.interface';

export interface PhysicalAddressBlock {
  address: string;
  landmark: string;
  state: string;
  city: string;
  pincode: string;
  businessName?: string;
}

export interface PhysicalPartyDetails {
  customerName: string;
  agreementNumber: string;
  product: string;
  mobile: string;
  alternateNumber: string;
  hasResidentialAddress: boolean;
  hasOfficeAddress: boolean;
  residential: PhysicalAddressBlock;
  office: PhysicalAddressBlock;
}

export interface DocumentTypeVerification {
  documentType: string;
  documentPrimaryKey: string;
  remark: string;
  fileName: string;
  fileUrl?: string;
}

export interface PhysicalReportPayload {
  caseDetails: {
    lanNo: string;
    state: string;
    product: string;
    location: string;
    rcuManagerName: string;
  };
  trigger: string;
  sampledDocuments: {
    type: string;
    verificationRemark: string;
    additionalNote: string;
  }[];
  referNegativeFraud: {
    desktopCheck: string;
    verifierName: string;
    deDupeCheck: string;
    neighbourFeedback: string;
  };
  finalReport: {
    overallStatus: string;
    tat: string;
    pickUpDate: string;
    reportDate: string;
    localOrOgl: string;
    vendorName: string;
    verifierName: string;
  };
  fieldVisitPhotos: {
    addressType: 'Residential' | 'Office';
    landmarkDetails: string;
    longitude: string;
    latitude: string;
    googleStreetViewLink: string;
    lastUpdate: string;
    photos: { label: string; url: string }[];
  }[];
}
