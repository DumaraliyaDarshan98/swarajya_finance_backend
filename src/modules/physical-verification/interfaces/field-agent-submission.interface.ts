export interface GeoLocation {
  latitude: string;
  longitude: string;
  capturedAt?: string;
}

export interface AddressGeoDetails {
  landmarkDetails: string;
  latitude: string;
  longitude: string;
  googleStreetViewLink: string;
  lastUpdate: string;
}

export interface FamilyMemberEntry {
  name: string;
  relation: string;
}

export interface NeighbourEntry {
  personName: string;
  mobile: string;
  applicantLivingHere: string;
  yearsLiving: string;
}

export interface ColleagueEntry {
  personName: string;
  department: string;
  designation: string;
  yearsWorking: string;
  mobile: string;
  email: string;
}

export interface VerificationPhotos {
  locationSelfie: string;
  namePlateSelfie: string;
  visitingCard: string;
  frontView: string;
  leftSideView: string;
  rightSideView: string;
  selfieWithOwner: string;
}

export interface HomeAddressVerification {
  addressCorrect: string;
  doorLock: string;
  houseType: string;
  meetPersonName: string;
  meetPersonRelation: string;
  applicantLivingHere: string;
  yearsLiving: string;
  familyMembersCount: string;
  familyMembers: FamilyMemberEntry[];
  earningMembersCount: string;
  earningMembers: string[];
  documentProofUrl: string;
  meetPersonKycUrl: string;
  applicantKycUrl: string;
  neighbours: NeighbourEntry[];
  addressGeo: AddressGeoDetails;
  photos: VerificationPhotos;
  executiveRemark: string;
  additionalNote: string;
  triggerRemark: string;
  triggerFileUrl: string;
}

export interface OfficeAddressVerification {
  addressCorrect: string;
  officeClosed: string;
  localityType: string;
  customerName: string;
  designation: string;
  department: string;
  yearsWorking: string;
  dateOfJoining: string;
  salaryRecordCheck: string;
  recordMatch: string;
  salarySlipUrl: string;
  companyName: string;
  companyType: string;
  natureOfCompany: string;
  authorityType: string;
  companyBoard: string;
  companyActivity: string;
  yearFromAddress: string;
  totalStaff: string;
  staffSeen: string;
  companyPhone: string;
  companyEmail: string;
  colleagues: ColleagueEntry[];
  addressGeo: AddressGeoDetails;
  photos: VerificationPhotos;
  executiveRemark: string;
  additionalNote: string;
  triggerRemark: string;
  triggerFileUrl: string;
}

export interface AgentDrivingTracking {
  isDriving: boolean;
  destination: 'residential' | 'office' | null;
  startedAt?: string;
  stoppedAt?: string;
  routeHistory: GeoLocation[];
}

export interface FieldAgentSubmission {
  agentLocation: GeoLocation | null;
  agentTracking?: AgentDrivingTracking | null;
  verifyResidential: boolean;
  verifyOffice: boolean;
  residential: HomeAddressVerification | null;
  office: OfficeAddressVerification | null;
  savedAt?: string;
  submittedAt?: string;
}
