export type PhysicalVisitAddressType = 'RESIDENTIAL' | 'OFFICE';

export type PhysicalVerificationPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface VisitFieldAgentSubmission {
  agentLocation: import('./field-agent-submission.interface').GeoLocation | null;
  agentTracking?: import('./field-agent-submission.interface').AgentDrivingTracking | null;
  residential: import('./field-agent-submission.interface').HomeAddressVerification | null;
  office: import('./field-agent-submission.interface').OfficeAddressVerification | null;
  savedAt?: string;
  submittedAt?: string;
}
