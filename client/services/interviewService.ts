/**
 * Interview Service
 * Manages interview scheduling and feedback with Firestore persistence
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getTodayTL, toDateStringTL } from '@/lib/dateUtils';
import { notificationService } from '@/services/notificationService';

// ============================================
// Types
// ============================================

export type InterviewStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled';

export type InterviewType = 'phone' | 'video' | 'in_person' | 'panel';

export type InterviewDecision = 'hire' | 'reject' | 'hold' | 'next_round' | 'pending';

export interface InterviewFeedback {
  interviewerId: string;
  interviewerName: string;
  overallRating: 1 | 2 | 3 | 4 | 5;
  technicalSkills?: number;
  communicationSkills?: number;
  cultureFit?: number;
  strengths: string;
  weaknesses: string;
  recommendation: InterviewDecision;
  notes: string;
  submittedAt?: Date;
}

export interface PreInterviewCheck {
  criminalRecord: boolean;
  criminalRecordNotes?: string;
  referencesChecked: boolean;
  referenceNotes?: string;
  idVerified: boolean;
  idNotes?: string;
  educationVerified: boolean;
  educationNotes?: string;
}

export interface Interview {
  id?: string;
  tenantId: string;

  // Candidate info
  candidateId?: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  position: string;
  jobId?: string;

  // Schedule
  interviewDate: string; // YYYY-MM-DD
  interviewTime: string; // HH:MM
  duration: number; // minutes
  interviewType: InterviewType;
  location?: string;
  meetingLink?: string;

  // Panel / Interviewers
  interviewerIds: string[];
  interviewerNames: string[];

  // Pre-checks
  preChecks: PreInterviewCheck;

  // Communication
  invitationSent: boolean;
  invitationSentAt?: Date;
  reminderSent: boolean;
  reminderSentAt?: Date;
  candidateConfirmed: boolean;
  followUpCall: boolean;

  // Status & Result
  status: InterviewStatus;
  feedback: InterviewFeedback[];
  decision?: InterviewDecision;
  decisionNotes?: string;

  // Audit
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface InterviewFilters {
  status?: InterviewStatus;
  interviewType?: InterviewType;
  interviewerId?: string;
  candidateId?: string;
  jobId?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface InterviewStats {
  totalInterviews: number;
  scheduled: number;
  completed: number;
  cancelled: number;
  noShow: number;
  byDecision: Record<InterviewDecision, number>;
  averageRating: number;
}

// ============================================
// Constants
// ============================================

const INTERVIEWS_COLLECTION = 'interviews';

export const INTERVIEW_TYPES: { id: InterviewType; name: string }[] = [
  { id: 'phone', name: 'Phone Screen' },
  { id: 'video', name: 'Video Interview' },
  { id: 'in_person', name: 'In-Person' },
  { id: 'panel', name: 'Panel Interview' },
];

export const INTERVIEW_DURATIONS = [
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

export const DECISION_OPTIONS: { id: InterviewDecision; name: string; color: string }[] = [
  { id: 'pending', name: 'Pending Decision', color: 'gray' },
  { id: 'hire', name: 'Recommend Hire', color: 'green' },
  { id: 'next_round', name: 'Move to Next Round', color: 'blue' },
  { id: 'hold', name: 'Hold', color: 'yellow' },
  { id: 'reject', name: 'Reject', color: 'red' },
];

export const DEFAULT_PRE_CHECKS: PreInterviewCheck = {
  criminalRecord: false,
  referencesChecked: false,
  idVerified: false,
  educationVerified: false,
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get interview type display name
 */
export function getInterviewTypeName(type: InterviewType): string {
  return INTERVIEW_TYPES.find((t) => t.id === type)?.name || type;
}

/**
 * Get decision display name and color
 */
export function getDecisionDisplay(decision: InterviewDecision): { name: string; color: string } {
  return DECISION_OPTIONS.find((d) => d.id === decision) || { name: decision, color: 'gray' };
}

/**
 * Calculate pre-check completion percentage
 */
export function getPreCheckProgress(checks: PreInterviewCheck): number {
  const items = [
    checks.criminalRecord,
    checks.referencesChecked,
    checks.idVerified,
    checks.educationVerified,
  ];
  const completed = items.filter(Boolean).length;
  return Math.round((completed / items.length) * 100);
}

/**
 * Format interview date/time for display
 */
export function formatInterviewDateTime(date: string, time: string): string {
  const dateObj = new Date(`${date}T${time}`);
  return dateObj.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ============================================
// Interview Service
// ============================================

class InterviewService {
  // ----------------------------------------
  // CRUD Operations
  // ----------------------------------------

  /**
   * Create a new interview
   */
  async createInterview(
    tenantId: string,
    interview: Omit<Interview, 'id' | 'tenantId' | 'status' | 'feedback' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, INTERVIEWS_COLLECTION), {
        ...interview,
        tenantId,
        status: 'scheduled' as InterviewStatus,
        feedback: [],
        preChecks: interview.preChecks || DEFAULT_PRE_CHECKS,
        invitationSent: interview.invitationSent || false,
        reminderSent: false,
        candidateConfirmed: false,
        followUpCall: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return docRef.id;
    } catch (error) {
      console.error('Error creating interview:', error);
      throw error;
    }
  }

  /**
   * Get an interview by ID
   */
  async getInterview(tenantId: string, interviewId: string): Promise<Interview | null> {
    try {
      const docRef = doc(db, INTERVIEWS_COLLECTION, interviewId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.tenantId !== tenantId) {
          return null;
        }
        return this.mapDocToInterview(docSnap.id, data);
      }

      return null;
    } catch (error) {
      console.error('Error getting interview:', error);
      throw error;
    }
  }

  /**
   * Get all interviews with optional filters
   */
  async getInterviews(
    tenantId: string,
    filters?: InterviewFilters
  ): Promise<Interview[]> {
    try {
      let q = query(
        collection(db, INTERVIEWS_COLLECTION),
        where('tenantId', '==', tenantId),
        orderBy('interviewDate', 'desc')
      );

      if (filters?.status) {
        q = query(q, where('status', '==', filters.status));
      }

      if (filters?.interviewType) {
        q = query(q, where('interviewType', '==', filters.interviewType));
      }

      if (filters?.jobId) {
        q = query(q, where('jobId', '==', filters.jobId));
      }

      if (filters?.candidateId) {
        q = query(q, where('candidateId', '==', filters.candidateId));
      }

      if (filters?.dateFrom) {
        q = query(q, where('interviewDate', '>=', filters.dateFrom));
      }

      if (filters?.dateTo) {
        q = query(q, where('interviewDate', '<=', filters.dateTo));
      }

      const querySnapshot = await getDocs(q);
      let interviews: Interview[] = [];

      querySnapshot.forEach((doc) => {
        interviews.push(this.mapDocToInterview(doc.id, doc.data()));
      });

      // Client-side interviewer filter (array contains)
      if (filters?.interviewerId) {
        interviews = interviews.filter((i) =>
          i.interviewerIds.includes(filters.interviewerId!)
        );
      }

      return interviews;
    } catch (error) {
      console.error('Error getting interviews:', error);
      throw error;
    }
  }

  /**
   * Get upcoming interviews (next 7 days)
   */
  async getUpcomingInterviews(tenantId: string): Promise<Interview[]> {
    const today = getTodayTL();
    const nextWeek = toDateStringTL(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const q = query(
      collection(db, INTERVIEWS_COLLECTION),
      where('tenantId', '==', tenantId),
      where('status', '==', 'scheduled'),
      where('interviewDate', '>=', today),
      where('interviewDate', '<=', nextWeek),
      orderBy('interviewDate', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => this.mapDocToInterview(doc.id, doc.data()));
  }

  /**
   * Get today's interviews
   */
  async getTodayInterviews(tenantId: string): Promise<Interview[]> {
    const today = getTodayTL();
    const q = query(
      collection(db, INTERVIEWS_COLLECTION),
      where('tenantId', '==', tenantId),
      where('status', '==', 'scheduled'),
      where('interviewDate', '==', today)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => this.mapDocToInterview(doc.id, doc.data()));
  }

  /**
   * Update an interview
   */
  async updateInterview(
    tenantId: string,
    interviewId: string,
    updates: Partial<Omit<Interview, 'id' | 'tenantId' | 'createdAt'>>
  ): Promise<void> {
    try {
      // Verify ownership
      const existing = await this.getInterview(tenantId, interviewId);
      if (!existing) {
        throw new Error('Interview not found');
      }

      const docRef = doc(db, INTERVIEWS_COLLECTION, interviewId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating interview:', error);
      throw error;
    }
  }

  /**
   * Delete an interview
   */
  async deleteInterview(tenantId: string, interviewId: string): Promise<void> {
    try {
      const existing = await this.getInterview(tenantId, interviewId);
      if (!existing) {
        throw new Error('Interview not found');
      }

      const docRef = doc(db, INTERVIEWS_COLLECTION, interviewId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting interview:', error);
      throw error;
    }
  }

  // ----------------------------------------
  // Status Operations
  // ----------------------------------------

  /**
   * Mark interview as completed
   */
  async completeInterview(tenantId: string, interviewId: string): Promise<void> {
    await this.updateInterview(tenantId, interviewId, {
      status: 'completed',
    });
  }

  /**
   * Cancel interview
   */
  async cancelInterview(tenantId: string, interviewId: string, reason?: string): Promise<void> {
    await this.updateInterview(tenantId, interviewId, {
      status: 'cancelled',
      decisionNotes: reason,
    });
  }

  /**
   * Mark as no-show
   */
  async markNoShow(tenantId: string, interviewId: string): Promise<void> {
    await this.updateInterview(tenantId, interviewId, {
      status: 'no_show',
    });
  }

  /**
   * Reschedule interview
   */
  async rescheduleInterview(
    tenantId: string,
    interviewId: string,
    newDate: string,
    newTime: string,
    opts?: { companyName?: string; replyTo?: string }
  ): Promise<void> {
    const existing = await this.getInterview(tenantId, interviewId);

    await this.updateInterview(tenantId, interviewId, {
      interviewDate: newDate,
      interviewTime: newTime,
      status: 'rescheduled',
      reminderSent: false,
      candidateConfirmed: false,
    });

    // If the candidate was already invited, tell them the time changed.
    // Non-fatal: a failed email must not undo the reschedule.
    if (existing?.invitationSent && existing.candidateEmail?.trim()) {
      const company = opts?.companyName || 'our company';
      try {
        await notificationService.queueEmail({
          tenantId,
          to: existing.candidateEmail,
          replyTo: opts?.replyTo,
          subject: `Interview rescheduled — ${existing.position} at ${company}, now ${newDate} ${newTime}`,
          text: [
            `Dear ${existing.candidateName},`,
            '',
            `Your interview for ${existing.position} at ${company} has been rescheduled.`,
            '',
            `New date: ${newDate}`,
            `New time: ${newTime}`,
            ...(existing.location ? [`Location: ${existing.location}`] : []),
            ...(existing.meetingLink ? [`Video link: ${existing.meetingLink}`] : []),
            '',
            'Please reply to this email to confirm the new time.',
            '',
            `Ita-nia entrevista muda ona ba ${newDate} tuku ${newTime}. Favór responde atu konfirma.`,
            '',
            `— ${company} (sent via Xefe)`,
          ].join('\n'),
          purpose: 'interview-reschedule',
          relatedId: interviewId,
        });
      } catch (error) {
        console.error('Interview reschedule email failed:', error);
      }
    }
  }

  // ----------------------------------------
  // Pre-Check Operations
  // ----------------------------------------

  /**
   * Update a pre-check item
   */
  async updatePreCheck(
    tenantId: string,
    interviewId: string,
    check: keyof PreInterviewCheck,
    value: boolean,
    notes?: string
  ): Promise<void> {
    const existing = await this.getInterview(tenantId, interviewId);
    if (!existing) {
      throw new Error('Interview not found');
    }

    const updatedChecks = {
      ...existing.preChecks,
      [check]: value,
    };

    if (notes !== undefined) {
      const notesKey = `${check}Notes` as keyof PreInterviewCheck;
      (updatedChecks as Record<string, unknown>)[notesKey] = notes;
    }

    await this.updateInterview(tenantId, interviewId, {
      preChecks: updatedChecks,
    });
  }

  // ----------------------------------------
  // Communication Operations
  // ----------------------------------------

  /** Candidate-facing schedule lines shared by invitation/reminder emails. */
  private interviewDetailLines(interview: Interview): string[] {
    return [
      `Date: ${interview.interviewDate}`,
      `Time: ${interview.interviewTime} (${interview.duration} minutes)`,
      `Format: ${interview.interviewType}`,
      ...(interview.location ? [`Location: ${interview.location}`] : []),
      ...(interview.meetingLink ? [`Video link: ${interview.meetingLink}`] : []),
    ];
  }

  /**
   * Email the interview invitation to the candidate. Returns false when the
   * interview has no candidateEmail (caller decides how to surface that).
   */
  async sendInvitationEmail(
    tenantId: string,
    interview: Interview,
    opts?: { companyName?: string; replyTo?: string },
  ): Promise<boolean> {
    const email = interview.candidateEmail?.trim();
    if (!email) return false;
    const company = opts?.companyName || 'our company';

    await notificationService.queueEmail({
      tenantId,
      to: email,
      replyTo: opts?.replyTo,
      subject: `Interview invitation — ${interview.position} at ${company}`,
      text: [
        `Dear ${interview.candidateName},`,
        '',
        `You are invited to an interview for the position of ${interview.position} at ${company}.`,
        '',
        ...this.interviewDetailLines(interview),
        '',
        'Please reply to this email to confirm you can attend.',
        '',
        `Konvite ba entrevista ba pozisaun ${interview.position} iha ${company}, ${interview.interviewDate} tuku ${interview.interviewTime}. Favór responde atu konfirma.`,
        '',
        `— ${company} (sent via Xefe)`,
      ].join('\n'),
      purpose: 'interview-invitation',
      relatedId: interview.id,
    });
    return true;
  }

  /**
   * Email an interview reminder to the candidate. Returns false when there is
   * no candidateEmail.
   */
  async sendReminderEmail(
    tenantId: string,
    interview: Interview,
    opts?: { companyName?: string; replyTo?: string },
  ): Promise<boolean> {
    const email = interview.candidateEmail?.trim();
    if (!email) return false;
    const company = opts?.companyName || 'our company';

    await notificationService.queueEmail({
      tenantId,
      to: email,
      replyTo: opts?.replyTo,
      subject: `Interview reminder — ${interview.position} at ${company}, ${interview.interviewDate} ${interview.interviewTime}`,
      text: [
        `Dear ${interview.candidateName},`,
        '',
        `A friendly reminder about your upcoming interview for ${interview.position} at ${company}.`,
        '',
        ...this.interviewDetailLines(interview),
        '',
        `Lembransa ba ita-nia entrevista iha ${interview.interviewDate} tuku ${interview.interviewTime}.`,
        '',
        `— ${company} (sent via Xefe)`,
      ].join('\n'),
      purpose: 'interview-reminder',
      relatedId: interview.id,
    });
    return true;
  }

  /**
   * Send the invitation email (when the candidate has one on file) and mark
   * the invitation as sent. Returns whether an email actually went out —
   * callers surface "no email on file" so the recruiter contacts them
   * directly instead of assuming the system did.
   */
  async sendInvitation(
    tenantId: string,
    interview: Interview,
    opts?: { companyName?: string; replyTo?: string },
  ): Promise<boolean> {
    const emailed = await this.sendInvitationEmail(tenantId, interview, opts);
    if (emailed) {
      await this.markInvitationSent(tenantId, interview.id!);
    }
    return emailed;
  }

  /**
   * Mark invitation as sent
   */
  async markInvitationSent(tenantId: string, interviewId: string): Promise<void> {
    await this.updateInterview(tenantId, interviewId, {
      invitationSent: true,
      invitationSentAt: new Date(),
    });
  }

  /**
   * Mark reminder as sent
   */
  async markReminderSent(tenantId: string, interviewId: string): Promise<void> {
    await this.updateInterview(tenantId, interviewId, {
      reminderSent: true,
      reminderSentAt: new Date(),
    });
  }

  /**
   * Mark candidate confirmed
   */
  async markCandidateConfirmed(tenantId: string, interviewId: string): Promise<void> {
    await this.updateInterview(tenantId, interviewId, {
      candidateConfirmed: true,
    });
  }

  /**
   * Mark follow-up call done
   */
  async markFollowUpCall(tenantId: string, interviewId: string): Promise<void> {
    await this.updateInterview(tenantId, interviewId, {
      followUpCall: true,
    });
  }

  // ----------------------------------------
  // Feedback Operations
  // ----------------------------------------

  /**
   * Add interviewer feedback
   */
  async addFeedback(
    tenantId: string,
    interviewId: string,
    feedback: Omit<InterviewFeedback, 'submittedAt'>
  ): Promise<void> {
    const existing = await this.getInterview(tenantId, interviewId);
    if (!existing) {
      throw new Error('Interview not found');
    }

    const newFeedback: InterviewFeedback = {
      ...feedback,
      submittedAt: new Date(),
    };

    // Replace existing feedback from same interviewer or add new
    const updatedFeedback = existing.feedback.filter(
      (f) => f.interviewerId !== feedback.interviewerId
    );
    updatedFeedback.push(newFeedback);

    await this.updateInterview(tenantId, interviewId, {
      feedback: updatedFeedback,
    });
  }

  /**
   * Make hiring decision
   */
  async makeDecision(
    tenantId: string,
    interviewId: string,
    decision: InterviewDecision,
    notes?: string,
    opts?: { companyName?: string; replyTo?: string }
  ): Promise<void> {
    const existing = await this.getInterview(tenantId, interviewId);

    await this.updateInterview(tenantId, interviewId, {
      decision,
      decisionNotes: notes,
      status: 'completed',
    });

    // Candidates hear the outcome for final decisions only (hire / reject) —
    // internal states (hold, next_round, pending) stay internal. Decision
    // notes are internal too and never emailed. Non-fatal.
    if ((decision === 'hire' || decision === 'reject') && existing?.candidateEmail?.trim()) {
      const company = opts?.companyName || 'our company';
      const hired = decision === 'hire';
      try {
        await notificationService.queueEmail({
          tenantId,
          to: existing.candidateEmail,
          replyTo: opts?.replyTo,
          subject: hired
            ? `Good news about your application — ${existing.position} at ${company}`
            : `Update on your application — ${existing.position} at ${company}`,
          text: [
            `Dear ${existing.candidateName},`,
            '',
            hired
              ? `Congratulations! Following your interview, we would like to move forward with you for the position of ${existing.position} at ${company}. We will contact you shortly with the next steps.`
              : `Thank you for taking the time to interview for ${existing.position} at ${company}. After careful consideration we will not be moving forward with your application on this occasion. We appreciate your interest and wish you every success.`,
            '',
            hired
              ? `Parabéns! Ami sei kontaktu ita lalais ho pasu tuir mai sira.`
              : `Obrigadu ba ita-nia tempu no interese. Infelizmente ami la avansa ho ita-nia aplikasaun iha biban ida ne'e.`,
            '',
            `— ${company} (sent via Xefe)`,
          ].join('\n'),
          purpose: 'interview-decision',
          relatedId: interviewId,
        });
      } catch (error) {
        console.error('Interview decision email failed:', error);
      }
    }
  }

  // ----------------------------------------
  // Statistics
  // ----------------------------------------

  /**
   * Get interview statistics
   */
  async getStats(tenantId: string, dateFrom?: string, dateTo?: string): Promise<InterviewStats> {
    try {
      const filters: InterviewFilters = {};
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;

      const allInterviews = await this.getInterviews(tenantId, filters);

      const scheduled = allInterviews.filter((i) => i.status === 'scheduled').length;
      const completed = allInterviews.filter((i) => i.status === 'completed').length;
      const cancelled = allInterviews.filter((i) => i.status === 'cancelled').length;
      const noShow = allInterviews.filter((i) => i.status === 'no_show').length;

      // Count by decision
      const byDecision: Record<InterviewDecision, number> = {
        pending: 0,
        hire: 0,
        reject: 0,
        hold: 0,
        next_round: 0,
      };

      let totalRating = 0;
      let ratingCount = 0;

      allInterviews.forEach((i) => {
        if (i.decision) {
          byDecision[i.decision]++;
        } else {
          byDecision.pending++;
        }

        // Calculate average rating from feedback
        i.feedback.forEach((f) => {
          totalRating += f.overallRating;
          ratingCount++;
        });
      });

      const averageRating = ratingCount > 0
        ? Math.round((totalRating / ratingCount) * 10) / 10
        : 0;

      return {
        totalInterviews: allInterviews.length,
        scheduled,
        completed,
        cancelled,
        noShow,
        byDecision,
        averageRating,
      };
    } catch (error) {
      console.error('Error getting interview stats:', error);
      throw error;
    }
  }

  /**
   * Get interviews for a candidate
   */
  async getCandidateInterviews(tenantId: string, candidateId: string): Promise<Interview[]> {
    const q = query(
      collection(db, INTERVIEWS_COLLECTION),
      where('tenantId', '==', tenantId),
      where('candidateId', '==', candidateId),
      orderBy('interviewDate', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => this.mapDocToInterview(doc.id, doc.data()));
  }

  /**
   * Get interviews for a job
   */
  async getJobInterviews(tenantId: string, jobId: string): Promise<Interview[]> {
    return this.getInterviews(tenantId, { jobId });
  }

  // ----------------------------------------
  // Helper Methods
  // ----------------------------------------

  /**
   * Map Firestore document to Interview
   */
  private mapDocToInterview(id: string, data: Record<string, unknown>): Interview {
    return {
      id,
      tenantId: data.tenantId as string,
      candidateId: data.candidateId as string | undefined,
      candidateName: data.candidateName as string,
      candidateEmail: data.candidateEmail as string,
      candidatePhone: data.candidatePhone as string | undefined,
      position: data.position as string,
      jobId: data.jobId as string | undefined,
      interviewDate: data.interviewDate as string,
      interviewTime: data.interviewTime as string,
      duration: data.duration as number,
      interviewType: data.interviewType as InterviewType,
      location: data.location as string | undefined,
      meetingLink: data.meetingLink as string | undefined,
      interviewerIds: (data.interviewerIds as string[]) || [],
      interviewerNames: (data.interviewerNames as string[]) || [],
      preChecks: (data.preChecks as PreInterviewCheck) || DEFAULT_PRE_CHECKS,
      invitationSent: data.invitationSent as boolean || false,
      invitationSentAt: data.invitationSentAt instanceof Timestamp
        ? data.invitationSentAt.toDate()
        : data.invitationSentAt as Date | undefined,
      reminderSent: data.reminderSent as boolean || false,
      reminderSentAt: data.reminderSentAt instanceof Timestamp
        ? data.reminderSentAt.toDate()
        : data.reminderSentAt as Date | undefined,
      candidateConfirmed: data.candidateConfirmed as boolean || false,
      followUpCall: data.followUpCall as boolean || false,
      status: data.status as InterviewStatus,
      feedback: (data.feedback as InterviewFeedback[]) || [],
      decision: data.decision as InterviewDecision | undefined,
      decisionNotes: data.decisionNotes as string | undefined,
      createdBy: data.createdBy as string,
      createdAt: data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : data.createdAt as Date | undefined,
      updatedAt: data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate()
        : data.updatedAt as Date | undefined,
    };
  }
}

export const interviewService = new InterviewService();
