import type { PhysicalVerification } from '../entities/physical-verification.entity';
import type { PhysicalVerificationVisit } from '../entities/physical-verification-visit.entity';
import type {
  PhysicalAddressBlock,
  PhysicalPartyDetails,
  PhysicalVerificationStatus,
} from '../interfaces/physical-verification.interface';
import type { PhysicalVisitAddressType } from '../interfaces/physical-verification-visit.interface';

export function buildVisitsFromParent(
  record: PhysicalVerification,
): Array<{ addressType: PhysicalVisitAddressType; addressSnapshot: PhysicalAddressBlock }> {
  const applicant = record.applicant;
  const visits: Array<{ addressType: PhysicalVisitAddressType; addressSnapshot: PhysicalAddressBlock }> = [];

  if (applicant?.hasResidentialAddress) {
    visits.push({
      addressType: 'RESIDENTIAL',
      addressSnapshot: { ...applicant.residential },
    });
  }
  if (applicant?.hasOfficeAddress) {
    visits.push({
      addressType: 'OFFICE',
      addressSnapshot: {
        ...applicant.office,
        businessName: applicant.office?.businessName ?? '',
      },
    });
  }
  return visits;
}

export function visitAddressLabel(visit: PhysicalVerificationVisit): string {
  const snap = visit.addressSnapshot;
  const parts = [
    snap?.address,
    snap?.landmark,
    snap?.city,
    snap?.state,
    snap?.pincode,
  ]
    .map((p) => p?.trim())
    .filter(Boolean);
  return parts.join(', ') || visit.addressType;
}

export function rollupParentStatus(
  visits: PhysicalVerificationVisit[],
): PhysicalVerificationStatus {
  if (!visits.length) {
    return 'IN_PROGRESS';
  }
  if (visits.every((v) => v.status === 'REPORT_GENERATED')) {
    return 'REPORT_GENERATED';
  }
  if (visits.every((v) => v.status === 'APPROVED')) {
    return 'APPROVED';
  }
  if (visits.some((v) => v.status === 'REJECTED')) {
    return 'REJECTED';
  }
  if (visits.every((v) => ['AGENT_SUBMITTED', 'APPROVED'].includes(v.status))) {
    return 'AGENT_SUBMITTED';
  }
  if (visits.some((v) => v.status === 'AGENT_SUBMITTED')) {
    return 'AGENT_SUBMITTED';
  }
  if (visits.some((v) => v.status === 'AGENT_DRAFT')) {
    return 'AGENT_DRAFT';
  }

  const inAssignmentPhase = visits.every((v) =>
    ['IN_PROGRESS', 'AGENT_ASSIGNED'].includes(v.status),
  );
  if (inAssignmentPhase) {
    const assignedCount = visits.filter((v) => !!v.assignedFieldAgentUserId).length;
    if (assignedCount > 0) {
      if (visits.length > 1 && assignedCount < visits.length) {
        return 'PARTIAL_ASSIGNED';
      }
      return 'ASSIGNED';
    }
    return 'IN_PROGRESS';
  }

  if (visits.some((v) => v.status === 'AGENT_ASSIGNED')) {
    return 'AGENT_ASSIGNED';
  }
  return 'IN_PROGRESS';
}

export function allVisitsApproved(visits: PhysicalVerificationVisit[]): boolean {
  return visits.length > 0 && visits.every((v) => v.status === 'APPROVED');
}

export function formatPartyAddress(
  party: PhysicalPartyDetails | null | undefined,
  addressType: PhysicalVisitAddressType,
): string {
  if (!party) return '';
  const block = addressType === 'RESIDENTIAL' ? party.residential : party.office;
  return [block?.address, block?.landmark, block?.city, block?.state, block?.pincode]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(', ');
}
