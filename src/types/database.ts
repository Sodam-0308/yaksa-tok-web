/** Supabase Database type definitions
 *  Auto-generate later with: npx supabase gen types typescript --project-id YOUR_PROJECT_ID
 */

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: "patient" | "pharmacist";
          name: string;
          phone: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      pharmacist_profiles: {
        Row: {
          id: string;
          pharmacy_name: string;
          address: string;
          lat: number | null;
          lng: number | null;
          specialties: string[] | null;
          bio: string | null;
          is_nationwide: boolean;
          remote_fee: number;
          can_ship_supplements: boolean;
          weekly_slots: Record<string, string[]> | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["pharmacist_profiles"]["Row"], "created_at" | "is_nationwide" | "remote_fee" | "can_ship_supplements" | "is_active"> & {
          is_nationwide?: boolean;
          remote_fee?: number;
          can_ship_supplements?: boolean;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["pharmacist_profiles"]["Insert"]>;
      };
      consultations: {
        Row: {
          id: string;
          patient_id: string;
          pharmacist_id: string | null;
          consultation_type: "local" | "remote";
          status: string;
          ai_answers: Record<string, unknown>;
          free_text: string;
          ai_summary: string | null;
          payment_id: string | null;
          paid_amount: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["consultations"]["Row"], "id" | "created_at" | "paid_amount" | "status"> & {
          status?: string;
          paid_amount?: number;
        };
        Update: Partial<Database["public"]["Tables"]["consultations"]["Insert"]>;
      };
      messages: {
        Row: {
          id: string;
          consultation_id: string;
          sender_id: string;
          content: string;
          message_type: "text" | "image" | "health_report";
          is_read: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["messages"]["Row"], "id" | "created_at" | "is_read" | "message_type"> & {
          message_type?: "text" | "image" | "health_report";
          is_read?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
      };
      case_studies: {
        Row: {
          id: string;
          pharmacist_id: string;
          title: string;
          symptoms: string[];
          patient_age_group: string | null;
          patient_gender: string | null;
          description: string;
          supplements_used: string[] | null;
          outcome: string;
          duration_weeks: number | null;
          is_published: boolean;
          likes_count: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["case_studies"]["Row"], "id" | "created_at" | "is_published" | "likes_count"> & {
          is_published?: boolean;
          likes_count?: number;
        };
        Update: Partial<Database["public"]["Tables"]["case_studies"]["Insert"]>;
      };
      health_checks: {
        Row: {
          id: string;
          patient_id: string;
          consultation_id: string;
          check_type: string;
          scores: Record<string, number>;
          memo: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["health_checks"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["health_checks"]["Insert"]>;
      };
    };
  };
}
