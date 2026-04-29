/**
 * Supabase 테이블 타입 정의
 * Row: SELECT 결과 / Insert: INSERT 페이로드 / Update: UPDATE 페이로드
 */

type UUID = string;
type ISODate = string;       // YYYY-MM-DD
type ISOTimestamp = string;  // YYYY-MM-DDTHH:MM:SS.sssZ

/* ══════════════════════════════════════════
   JSON 서브타입 (jsonb 컬럼용)
   ══════════════════════════════════════════ */

export interface SupplementItem {
  name: string;
  dosage: string;
  timing: string;
  memo?: string;
}

export interface ScoreSnapshot {
  energy?: number;
  sleep?: number;
  digestion?: number;
  mood?: number;
  discomfort?: number;
  [key: string]: number | undefined;
}

export interface WeeklySlots {
  mon?: string[];
  tue?: string[];
  wed?: string[];
  thu?: string[];
  fri?: string[];
  sat?: string[];
  sun?: string[];
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/* ══════════════════════════════════════════
   Enum 계열
   ══════════════════════════════════════════ */

export type UserRole = "patient" | "pharmacist";
export type ConsultationType = "local" | "remote";
export type ConsultationStatus =
  | "pending" | "matched" | "accepted" | "rejected"
  | "chatting" | "visit_scheduled" | "visited"
  | "report_sent" | "completed" | "cancelled";
export type MessageType = "text" | "image" | "health_report" | "system";
export type DosageStatus = "taking" | "completed" | "stopped";
export type CaseAuthorType = "pharmacist" | "patient";
export type FollowUpStatus = "scheduled" | "sent" | "cancelled";
export type VisitScheduleStatus = "scheduled" | "visited" | "cancelled";
export type SymptomStatus = "ongoing" | "resolved" | "monitoring";
export type ReportStatus = "pending" | "reviewed" | "dismissed";

/* ══════════════════════════════════════════
   profiles
   ══════════════════════════════════════════ */

export interface ProfileRow {
  id: UUID;
  role: UserRole;
  name: string;
  phone: string | null;
  avatar_url: string | null;
  auth_provider: string | null;
  is_active: boolean;
  role_confirmed: boolean;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}
export type ProfileInsert = Omit<ProfileRow, "created_at" | "updated_at" | "is_active" | "role_confirmed"> & {
  is_active?: boolean;
  role_confirmed?: boolean;
  created_at?: ISOTimestamp;
  updated_at?: ISOTimestamp;
};
export type ProfileUpdate = Partial<Omit<ProfileRow, "id">>;

/* ══════════════════════════════════════════
   patient_profiles
   ══════════════════════════════════════════ */

export interface PatientProfileRow {
  id: UUID;
  birth_year: number | null;
  gender: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  body_recorded_at: ISOTimestamp | null;
  monthly_budget: number | null;
  case_study_consent: boolean;
  case_study_consent_at: ISOTimestamp | null;
}
export type PatientProfileInsert = Omit<PatientProfileRow, "case_study_consent"> & {
  case_study_consent?: boolean;
};
export type PatientProfileUpdate = Partial<Omit<PatientProfileRow, "id">>;

/* ══════════════════════════════════════════
   pharmacist_profiles
   ══════════════════════════════════════════ */

export interface PharmacistProfileRow {
  id: UUID;
  pharmacy_name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  license_number: string | null;
  license_name: string | null;
  license_photo_url: string | null;
  business_number: string | null;
  expert_specialties: string[];
  available_specialties: string[];
  bio: string | null;
  pharmacy_photos: string[];
  is_nationwide: boolean;
  remote_fee: number;
  can_ship_supplements: boolean;
  weekly_slots: WeeklySlots | null;
  avg_response_minutes: number | null;
  total_consultations: number;
  total_improvements: number;
  is_verified: boolean;
  verified_at: ISOTimestamp | null;
  is_active: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  auto_followup_days: number | null;
}
export type PharmacistProfileInsert = Omit<
  PharmacistProfileRow,
  | "expert_specialties" | "available_specialties" | "pharmacy_photos"
  | "is_nationwide" | "remote_fee" | "can_ship_supplements"
  | "total_consultations" | "total_improvements"
  | "is_verified" | "is_active"
  | "license_name"
> & {
  expert_specialties?: string[];
  available_specialties?: string[];
  pharmacy_photos?: string[];
  is_nationwide?: boolean;
  remote_fee?: number;
  can_ship_supplements?: boolean;
  total_consultations?: number;
  total_improvements?: number;
  is_verified?: boolean;
  is_active?: boolean;
  license_name?: string | null;
};
export type PharmacistProfileUpdate = Partial<Omit<PharmacistProfileRow, "id">>;

/* ══════════════════════════════════════════
   consultations
   ══════════════════════════════════════════ */

export interface ConsultationRow {
  id: UUID;
  patient_id: UUID;
  pharmacist_id: UUID | null;
  questionnaire_id: UUID | null;
  consultation_type: ConsultationType;
  matching_source: string | null;
  status: ConsultationStatus;
  rejected_reason: string | null;
  rejected_at: ISOTimestamp | null;
  payment_id: string | null;
  paid_amount: number;
  registration_source: string | null;
  patient_tag: string | null;
  is_dedicated: boolean;
  dedicated_at: ISOTimestamp | null;
  is_favorite: boolean;
  purchase_count: number;
  last_message_at: ISOTimestamp | null;
  unread_count_patient: number;
  unread_count_pharmacist: number;
}
export type ConsultationInsert = Partial<ConsultationRow> & {
  patient_id: UUID;
  consultation_type: ConsultationType;
};
export type ConsultationUpdate = Partial<Omit<ConsultationRow, "id" | "patient_id">>;

/* ══════════════════════════════════════════
   consultation_rounds
   ══════════════════════════════════════════ */

export interface ConsultationRoundRow {
  id: UUID;
  consultation_id: UUID;
  round_number: number;
  questionnaire_id: UUID | null;
  started_at: ISOTimestamp;
  ended_at: ISOTimestamp | null;
  status: string;
}
export type ConsultationRoundInsert = Omit<ConsultationRoundRow, "id" | "started_at"> & {
  id?: UUID;
  started_at?: ISOTimestamp;
};
export type ConsultationRoundUpdate = Partial<Omit<ConsultationRoundRow, "id" | "consultation_id">>;

/* ══════════════════════════════════════════
   messages
   ══════════════════════════════════════════ */

export interface MessageRow {
  id: UUID;
  consultation_id: UUID;
  round_id: UUID | null;
  sender_id: UUID;
  content: string;
  message_type: MessageType;
  metadata: Json | null;
  image_url: string | null;
  is_pharmacist_only: boolean;
  is_read: boolean;
  read_at: ISOTimestamp | null;
  created_at: ISOTimestamp;
}
export type MessageInsert = Partial<MessageRow> & {
  consultation_id: UUID;
  sender_id: UUID;
  content: string;
};
export type MessageUpdate = Partial<Omit<MessageRow, "id" | "consultation_id" | "sender_id" | "created_at">>;

/* ══════════════════════════════════════════
   ai_questionnaires
   ══════════════════════════════════════════ */

export interface AiQuestionnaireRow {
  id: UUID;
  patient_id: UUID | null;
  symptoms: string[];
  symptom_duration: string | null;
  severity: string | null;
  occupation: string | null;
  sleep_hours: number | null;
  water_intake: number | null;
  meal_pattern: string | null;
  snack_frequency: string | null;
  exercise_frequency: string | null;
  exercise_types: string[];
  alcohol: string | null;
  caffeine: string | null;
  smoking: string | null;
  current_supplements: string[];
  current_medications: string[];
  allergies: string[];
  monthly_budget: number | null;
  free_text: string;
  detailed_answers: Json | null;
  ai_summary: string | null;
  completed_at: ISOTimestamp | null;
}
export type AiQuestionnaireInsert = Partial<AiQuestionnaireRow> & {
  patient_id: UUID | null;
};
export type AiQuestionnaireUpdate = Partial<Omit<AiQuestionnaireRow, "id">>;

/* ══════════════════════════════════════════
   case_studies
   ══════════════════════════════════════════ */

export interface CaseStudyRow {
  id: UUID;
  author_id: UUID;
  author_type: CaseAuthorType;
  pharmacist_id: UUID | null;
  title: string;
  symptoms: string[];
  patient_age_group: string | null;
  patient_gender: string | null;
  description: string;
  outcome: string | null;
  duration_weeks: number | null;
  show_health_score: boolean;
  before_scores: ScoreSnapshot | null;
  after_scores: ScoreSnapshot | null;
  photos: string[];
  patient_consent_checked: boolean;
  is_published: boolean;
  likes_count: number;
  views_count: number;
}
export type CaseStudyInsert = Omit<
  CaseStudyRow,
  | "id" | "symptoms" | "photos"
  | "show_health_score" | "patient_consent_checked"
  | "is_published" | "likes_count" | "views_count"
> & {
  id?: UUID;
  symptoms?: string[];
  photos?: string[];
  show_health_score?: boolean;
  patient_consent_checked?: boolean;
  is_published?: boolean;
  likes_count?: number;
  views_count?: number;
};
export type CaseStudyUpdate = Partial<Omit<CaseStudyRow, "id" | "author_id">>;

/* ══════════════════════════════════════════
   health_checks
   ══════════════════════════════════════════ */

export interface HealthCheckRow {
  id: UUID;
  patient_id: UUID;
  consultation_id: UUID | null;
  energy_score: number;
  sleep_score: number;
  digestion_score: number;
  mood_score: number;
  discomfort_score: number;
  memo: string | null;
  created_at: ISOTimestamp;
}
export type HealthCheckInsert = Omit<HealthCheckRow, "id" | "created_at"> & {
  id?: UUID;
  created_at?: ISOTimestamp;
};
export type HealthCheckUpdate = Partial<Omit<HealthCheckRow, "id" | "patient_id" | "created_at">>;

/* ══════════════════════════════════════════
   dosage_guides
   ══════════════════════════════════════════ */

export interface DosageGuideRow {
  id: UUID;
  consultation_id: UUID;
  round_id: UUID | null;
  pharmacist_id: UUID;
  patient_id: UUID;
  supplements: SupplementItem[];
  dosage_days: number | null;
  dosage_end_date: ISODate | null;
  custom_guide: string | null;
  dosage_status: DosageStatus;
  dosage_status_changed_at: ISOTimestamp | null;
  sent_at: ISOTimestamp | null;
}
export type DosageGuideInsert = Omit<
  DosageGuideRow, "id" | "supplements" | "dosage_status"
> & {
  id?: UUID;
  supplements?: SupplementItem[];
  dosage_status?: DosageStatus;
};
export type DosageGuideUpdate = Partial<Omit<DosageGuideRow, "id" | "consultation_id" | "patient_id" | "pharmacist_id">>;

/* ══════════════════════════════════════════
   visit_records
   ══════════════════════════════════════════ */

export interface VisitRecordRow {
  id: UUID;
  consultation_id: UUID;
  round_id: UUID | null;
  pharmacist_id: UUID;
  patient_id: UUID;
  visit_date: ISODate;
  purchased_supplements: SupplementItem[];
  patient_complaint: string | null;
  patient_improvement: string | null;
  pharmacist_guide: string | null;
  pharmacist_opinion: string | null;
  dosage_days: number | null;
  dosage_end_date: ISODate | null;
  pharmacist_photos: string[];
}
export type VisitRecordInsert = Omit<
  VisitRecordRow, "id" | "purchased_supplements" | "pharmacist_photos"
> & {
  id?: UUID;
  purchased_supplements?: SupplementItem[];
  pharmacist_photos?: string[];
};
export type VisitRecordUpdate = Partial<Omit<VisitRecordRow, "id" | "consultation_id" | "patient_id" | "pharmacist_id">>;

/* ══════════════════════════════════════════
   reply_templates
   ══════════════════════════════════════════ */

export interface ReplyTemplateRow {
  id: UUID;
  pharmacist_id: UUID;
  title: string;
  content: string;
  category: string | null;
  sort_order: number;
}
export type ReplyTemplateInsert = Omit<ReplyTemplateRow, "id" | "sort_order"> & {
  id?: UUID;
  sort_order?: number;
};
export type ReplyTemplateUpdate = Partial<Omit<ReplyTemplateRow, "id" | "pharmacist_id">>;

/* ══════════════════════════════════════════
   pharmacist_badges
   ══════════════════════════════════════════ */

export interface PharmacistBadgeRow {
  id: UUID;
  pharmacist_id: UUID;
  badge_type: string;
  earned_at: ISOTimestamp;
}
export type PharmacistBadgeInsert = Omit<PharmacistBadgeRow, "id" | "earned_at"> & {
  id?: UUID;
  earned_at?: ISOTimestamp;
};
export type PharmacistBadgeUpdate = Partial<Omit<PharmacistBadgeRow, "id" | "pharmacist_id">>;

/* ══════════════════════════════════════════
   symptom_records
   ══════════════════════════════════════════ */

export interface SymptomRecordRow {
  id: UUID;
  consultation_id: UUID | null;
  pharmacist_id: UUID | null;
  patient_id: UUID;
  symptom_name: string;
  symptom_category: string | null;
  status: SymptomStatus;
  severity: number | null;
  started_at: ISOTimestamp | null;
  started_date: ISODate | null;
  resolved_at: ISOTimestamp | null;
  detail_memo: string | null;
}
export type SymptomRecordInsert = Omit<SymptomRecordRow, "id" | "status"> & {
  id?: UUID;
  status?: SymptomStatus;
};
export type SymptomRecordUpdate = Partial<Omit<SymptomRecordRow, "id" | "patient_id">>;

/* ══════════════════════════════════════════
   pharmacist_notes
   ══════════════════════════════════════════ */

export interface PharmacistNoteRow {
  id: UUID;
  consultation_id: UUID | null;
  pharmacist_id: UUID;
  patient_id: UUID;
  content: string;
}
export type PharmacistNoteInsert = Omit<PharmacistNoteRow, "id"> & { id?: UUID };
export type PharmacistNoteUpdate = Partial<Omit<PharmacistNoteRow, "id" | "pharmacist_id" | "patient_id">>;

/* ══════════════════════════════════════════
   pre_visit_reports
   ══════════════════════════════════════════ */

export interface PreVisitReportRow {
  id: UUID;
  consultation_id: UUID;
  round_id: UUID | null;
  pharmacist_id: UUID;
  patient_id: UUID;
  nutrition_enabled: boolean;
  nutrition_categories: string[];
  lifestyle_recommendations: string[];
  pharmacist_comment: string | null;
  sent_at: ISOTimestamp | null;
}
export type PreVisitReportInsert = Omit<
  PreVisitReportRow, "id" | "nutrition_categories" | "lifestyle_recommendations" | "nutrition_enabled"
> & {
  id?: UUID;
  nutrition_enabled?: boolean;
  nutrition_categories?: string[];
  lifestyle_recommendations?: string[];
};
export type PreVisitReportUpdate = Partial<Omit<PreVisitReportRow, "id" | "consultation_id" | "pharmacist_id" | "patient_id">>;

/* ══════════════════════════════════════════
   follow_up_schedules
   ══════════════════════════════════════════ */

export interface FollowUpScheduleRow {
  id: UUID;
  consultation_id: UUID;
  round_id: UUID | null;
  pharmacist_id: UUID;
  patient_id: UUID;
  scheduled_at: ISOTimestamp;
  message_content: string;
  status: FollowUpStatus;
  sent_at: ISOTimestamp | null;
  cancelled_at: ISOTimestamp | null;
}
export type FollowUpScheduleInsert = Omit<FollowUpScheduleRow, "id" | "status"> & {
  id?: UUID;
  status?: FollowUpStatus;
};
export type FollowUpScheduleUpdate = Partial<Omit<FollowUpScheduleRow, "id" | "consultation_id" | "pharmacist_id" | "patient_id">>;

/* ══════════════════════════════════════════
   visit_schedules
   ══════════════════════════════════════════ */

export interface VisitScheduleRow {
  id: UUID;
  consultation_id: UUID;
  round_id: UUID | null;
  pharmacist_id: UUID;
  patient_id: UUID;
  scheduled_date: ISODate;
  scheduled_time: string | null;
  note: string | null;
  status: VisitScheduleStatus;
  cancelled_at: ISOTimestamp | null;
}
export type VisitScheduleInsert = Omit<VisitScheduleRow, "id" | "status"> & {
  id?: UUID;
  status?: VisitScheduleStatus;
};
export type VisitScheduleUpdate = Partial<Omit<VisitScheduleRow, "id" | "consultation_id" | "pharmacist_id" | "patient_id">>;

/* ══════════════════════════════════════════
   pharmacist_question_sets
   ══════════════════════════════════════════ */

export interface PharmacistQuestion {
  text: string;
  type: "객관식" | "주관식" | "다중 선택";
  choices?: string[];
}
export interface PharmacistQuestionSetRow {
  id: UUID;
  pharmacist_id: UUID;
  title: string;
  is_default: boolean;
  questions: PharmacistQuestion[];
}
export type PharmacistQuestionSetInsert = Omit<
  PharmacistQuestionSetRow, "id" | "is_default" | "questions"
> & {
  id?: UUID;
  is_default?: boolean;
  questions?: PharmacistQuestion[];
};
export type PharmacistQuestionSetUpdate = Partial<Omit<PharmacistQuestionSetRow, "id" | "pharmacist_id">>;

/* ══════════════════════════════════════════
   custom_question_answers
   ══════════════════════════════════════════ */

export interface CustomQuestionAnswerRow {
  id: UUID;
  consultation_id: UUID;
  question_set_id: UUID;
  patient_id: UUID;
  answers: Json;
  answered_at: ISOTimestamp;
}
export type CustomQuestionAnswerInsert = Omit<CustomQuestionAnswerRow, "id" | "answered_at"> & {
  id?: UUID;
  answered_at?: ISOTimestamp;
};
export type CustomQuestionAnswerUpdate = Partial<Omit<CustomQuestionAnswerRow, "id" | "consultation_id" | "patient_id">>;

/* ══════════════════════════════════════════
   improvement_confirmations
   ══════════════════════════════════════════ */

export interface ImprovementConfirmationRow {
  id: UUID;
  consultation_id: UUID;
  pharmacist_id: UUID;
  patient_id: UUID;
  symptom_area: string;
  before_check_id: UUID | null;
  after_check_id: UUID | null;
  before_score: number;
  after_score: number;
  improvement_points: number;
  confirmed_at: ISOTimestamp;
}
export type ImprovementConfirmationInsert = Omit<ImprovementConfirmationRow, "id" | "confirmed_at"> & {
  id?: UUID;
  confirmed_at?: ISOTimestamp;
};
export type ImprovementConfirmationUpdate = Partial<Omit<ImprovementConfirmationRow, "id" | "consultation_id" | "pharmacist_id" | "patient_id">>;

/* ══════════════════════════════════════════
   medication_status (지난 상담 단위 복용 상태 — 복용 중/완료/중단)
   ══════════════════════════════════════════ */

export interface MedicationStatusRow {
  id: UUID;
  patient_id: UUID;
  consultation_key: string;     // mock id 또는 실제 consultation UUID
  status: DosageStatus;
  updated_at: ISOTimestamp;
}
export type MedicationStatusInsert = Partial<MedicationStatusRow> & {
  patient_id: UUID;
  consultation_key: string;
  status: DosageStatus;
};
export type MedicationStatusUpdate = Partial<Omit<MedicationStatusRow, "id" | "patient_id" | "consultation_key">>;

/* ══════════════════════════════════════════
   medication_checks
   ══════════════════════════════════════════ */

export interface MedicationCheckRow {
  id: UUID;
  patient_id: UUID;
  dosage_guide_id: UUID | null;
  supplement_name: string;
  time_slot: string;             // 아침 / 점심 / 저녁 / 취침 전
  check_date: ISODate;
  is_checked: boolean;
  updated_at: ISOTimestamp;
}
export type MedicationCheckInsert = Partial<MedicationCheckRow> & {
  patient_id: UUID;
  supplement_name: string;
  time_slot: string;
  check_date: ISODate;
  is_checked: boolean;
};
export type MedicationCheckUpdate = Partial<Omit<MedicationCheckRow, "id" | "patient_id">>;

/* ══════════════════════════════════════════
   pharmacist_stories
   ══════════════════════════════════════════ */

export interface PharmacistStoryRow {
  id: UUID;
  pharmacist_id: UUID;
  title: string;
  symptoms: string[];
  subject_age_group: string | null;
  subject_gender: string | null;
  subject_relation: string | null;
  before_description: string;
  after_description: string;
  story: string | null;
  duration_text: string | null;
  photos: string[];
  is_published: boolean;
  likes_count: number;
  views_count: number;
}
export type PharmacistStoryInsert = Omit<
  PharmacistStoryRow,
  "id" | "symptoms" | "photos" | "is_published" | "likes_count" | "views_count"
> & {
  id?: UUID;
  symptoms?: string[];
  photos?: string[];
  is_published?: boolean;
  likes_count?: number;
  views_count?: number;
};
export type PharmacistStoryUpdate = Partial<Omit<PharmacistStoryRow, "id" | "pharmacist_id">>;

/* ══════════════════════════════════════════
   health_check_schedules
   ══════════════════════════════════════════ */

export interface HealthCheckScheduleRow {
  id: UUID;
  consultation_id: UUID | null;
  patient_id: UUID;
  pharmacist_id: UUID | null;
  interval_days: number;
  next_check_date: ISODate;
  total_check_period_days: number | null;
  start_date: ISODate;
  end_date: ISODate | null;
  is_active: boolean;
}
export type HealthCheckScheduleInsert = Omit<HealthCheckScheduleRow, "id" | "is_active"> & {
  id?: UUID;
  is_active?: boolean;
};
export type HealthCheckScheduleUpdate = Partial<Omit<HealthCheckScheduleRow, "id" | "patient_id">>;

/* ══════════════════════════════════════════
   reports (신고)
   ══════════════════════════════════════════ */

export interface ReportRow {
  id: UUID;
  reporter_id: UUID;
  target_type: string;
  target_id: UUID;
  reason: string;
  status: ReportStatus;
}
export type ReportInsert = Omit<ReportRow, "id" | "status"> & {
  id?: UUID;
  status?: ReportStatus;
};
export type ReportUpdate = Partial<Omit<ReportRow, "id" | "reporter_id">>;

/* ══════════════════════════════════════════
   Supabase Database (public 스키마)
   ══════════════════════════════════════════ */

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
      patient_profiles: {
        Row: PatientProfileRow;
        Insert: PatientProfileInsert;
        Update: PatientProfileUpdate;
      };
      pharmacist_profiles: {
        Row: PharmacistProfileRow;
        Insert: PharmacistProfileInsert;
        Update: PharmacistProfileUpdate;
      };
      consultations: {
        Row: ConsultationRow;
        Insert: ConsultationInsert;
        Update: ConsultationUpdate;
      };
      consultation_rounds: {
        Row: ConsultationRoundRow;
        Insert: ConsultationRoundInsert;
        Update: ConsultationRoundUpdate;
      };
      messages: {
        Row: MessageRow;
        Insert: MessageInsert;
        Update: MessageUpdate;
      };
      ai_questionnaires: {
        Row: AiQuestionnaireRow;
        Insert: AiQuestionnaireInsert;
        Update: AiQuestionnaireUpdate;
      };
      case_studies: {
        Row: CaseStudyRow;
        Insert: CaseStudyInsert;
        Update: CaseStudyUpdate;
      };
      health_checks: {
        Row: HealthCheckRow;
        Insert: HealthCheckInsert;
        Update: HealthCheckUpdate;
      };
      dosage_guides: {
        Row: DosageGuideRow;
        Insert: DosageGuideInsert;
        Update: DosageGuideUpdate;
      };
      visit_records: {
        Row: VisitRecordRow;
        Insert: VisitRecordInsert;
        Update: VisitRecordUpdate;
      };
      reply_templates: {
        Row: ReplyTemplateRow;
        Insert: ReplyTemplateInsert;
        Update: ReplyTemplateUpdate;
      };
      pharmacist_badges: {
        Row: PharmacistBadgeRow;
        Insert: PharmacistBadgeInsert;
        Update: PharmacistBadgeUpdate;
      };
      symptom_records: {
        Row: SymptomRecordRow;
        Insert: SymptomRecordInsert;
        Update: SymptomRecordUpdate;
      };
      pharmacist_notes: {
        Row: PharmacistNoteRow;
        Insert: PharmacistNoteInsert;
        Update: PharmacistNoteUpdate;
      };
      pre_visit_reports: {
        Row: PreVisitReportRow;
        Insert: PreVisitReportInsert;
        Update: PreVisitReportUpdate;
      };
      follow_up_schedules: {
        Row: FollowUpScheduleRow;
        Insert: FollowUpScheduleInsert;
        Update: FollowUpScheduleUpdate;
      };
      visit_schedules: {
        Row: VisitScheduleRow;
        Insert: VisitScheduleInsert;
        Update: VisitScheduleUpdate;
      };
      pharmacist_question_sets: {
        Row: PharmacistQuestionSetRow;
        Insert: PharmacistQuestionSetInsert;
        Update: PharmacistQuestionSetUpdate;
      };
      custom_question_answers: {
        Row: CustomQuestionAnswerRow;
        Insert: CustomQuestionAnswerInsert;
        Update: CustomQuestionAnswerUpdate;
      };
      improvement_confirmations: {
        Row: ImprovementConfirmationRow;
        Insert: ImprovementConfirmationInsert;
        Update: ImprovementConfirmationUpdate;
      };
      medication_checks: {
        Row: MedicationCheckRow;
        Insert: MedicationCheckInsert;
        Update: MedicationCheckUpdate;
      };
      medication_status: {
        Row: MedicationStatusRow;
        Insert: MedicationStatusInsert;
        Update: MedicationStatusUpdate;
      };
      pharmacist_stories: {
        Row: PharmacistStoryRow;
        Insert: PharmacistStoryInsert;
        Update: PharmacistStoryUpdate;
      };
      health_check_schedules: {
        Row: HealthCheckScheduleRow;
        Insert: HealthCheckScheduleInsert;
        Update: HealthCheckScheduleUpdate;
      };
      reports: {
        Row: ReportRow;
        Insert: ReportInsert;
        Update: ReportUpdate;
      };
    };
  };
}
