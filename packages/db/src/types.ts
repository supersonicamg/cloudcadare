
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "affiliate_conversions": {
                  Row: {
                    "affiliate_id": string,"commission_minor": number,"created_at": string,"id": string,"order_id": string,"paid_at": string | null,"status": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "affiliate_id": string,"commission_minor": number,"created_at"?: string,"id"?: string,"order_id": string,"paid_at"?: string | null,"status"?: string,"tenant_id": string
                  }
                  Update: {
                    "affiliate_id"?: string,"commission_minor"?: number,"created_at"?: string,"id"?: string,"order_id"?: string,"paid_at"?: string | null,"status"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "affiliate_conversions_tenant_id_affiliate_id_fkey"
      columns: ["tenant_id","affiliate_id"]
isOneToOne: false
      referencedRelation: "affiliates"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "affiliate_conversions_tenant_id_order_id_fkey"
      columns: ["tenant_id","order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"affiliates": {
                  Row: {
                    "code": string,"commission_pct": number,"created_at": string,"id": string,"member_id": string,"payout_details": NonNullable<Json>,"status": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"commission_pct"?: number,"created_at"?: string,"id"?: string,"member_id": string,"payout_details"?: NonNullable<Json>,"status"?: string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"commission_pct"?: number,"created_at"?: string,"id"?: string,"member_id"?: string,"payout_details"?: NonNullable<Json>,"status"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "affiliates_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"announcements": {
                  Row: {
                    "audience": NonNullable<Json>,"body": NonNullable<Json>,"channels": (string)[],"created_at": string,"created_by": string | null,"expires_at": string | null,"id": string,"is_pinned": boolean,"publish_at": string,"tenant_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "audience"?: NonNullable<Json>,"body": NonNullable<Json>,"channels"?: (string)[],"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"is_pinned"?: boolean,"publish_at"?: string,"tenant_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "audience"?: NonNullable<Json>,"body"?: NonNullable<Json>,"channels"?: (string)[],"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"is_pinned"?: boolean,"publish_at"?: string,"tenant_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"api_keys": {
                  Row: {
                    "created_at": string,"created_by": string | null,"expires_at": string | null,"id": string,"key_hash": string,"key_prefix": string,"last_used_at": string | null,"name": string,"revoked_at": string | null,"scopes": (string)[],"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"key_hash": string,"key_prefix": string,"last_used_at"?: string | null,"name": string,"revoked_at"?: string | null,"scopes"?: (string)[],"tenant_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"key_hash"?: string,"key_prefix"?: string,"last_used_at"?: string | null,"name"?: string,"revoked_at"?: string | null,"scopes"?: (string)[],"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "api_keys_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"assignment_submissions": {
                  Row: {
                    "assignment_id": string,"attachments": (string)[],"attempt_no": number,"content": Json | null,"created_at": string,"feedback": Json | null,"graded_at": string | null,"graded_by": string | null,"id": string,"marks": number | null,"member_id": string,"status": string,"submitted_at": string | null,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignment_id": string,"attachments"?: (string)[],"attempt_no"?: number,"content"?: Json | null,"created_at"?: string,"feedback"?: Json | null,"graded_at"?: string | null,"graded_by"?: string | null,"id"?: string,"marks"?: number | null,"member_id": string,"status"?: string,"submitted_at"?: string | null,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "assignment_id"?: string,"attachments"?: (string)[],"attempt_no"?: number,"content"?: Json | null,"created_at"?: string,"feedback"?: Json | null,"graded_at"?: string | null,"graded_by"?: string | null,"id"?: string,"marks"?: number | null,"member_id"?: string,"status"?: string,"submitted_at"?: string | null,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assignment_submissions_tenant_id_assignment_id_fkey"
      columns: ["tenant_id","assignment_id"]
isOneToOne: false
      referencedRelation: "assignments"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "assignment_submissions_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"assignments": {
                  Row: {
                    "allow_late": boolean,"batch_id": string | null,"course_id": string | null,"created_at": string,"created_by": string | null,"due_at": string | null,"id": string,"instructions": Json | null,"max_attempts": number,"max_marks": number | null,"rubric": Json | null,"status": string,"submission_types": (string)[],"tenant_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allow_late"?: boolean,"batch_id"?: string | null,"course_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"due_at"?: string | null,"id"?: string,"instructions"?: Json | null,"max_attempts"?: number,"max_marks"?: number | null,"rubric"?: Json | null,"status"?: string,"submission_types"?: (string)[],"tenant_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "allow_late"?: boolean,"batch_id"?: string | null,"course_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"due_at"?: string | null,"id"?: string,"instructions"?: Json | null,"max_attempts"?: number,"max_marks"?: number | null,"rubric"?: Json | null,"status"?: string,"submission_types"?: (string)[],"tenant_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assignments_tenant_id_batch_id_fkey"
      columns: ["tenant_id","batch_id"]
isOneToOne: false
      referencedRelation: "batches"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "assignments_tenant_id_course_id_fkey"
      columns: ["tenant_id","course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "assignments_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"attempt_answers": {
                  Row: {
                    "answered_at": string,"attempt_id": string,"flagged": boolean,"graded_by": string | null,"grader_feedback": string | null,"is_correct": boolean | null,"marks_awarded": number | null,"question_id": string,"response": Json | null,"tenant_id": string,"time_spent_seconds": number
                  }
                  ComputedFields: never
                  Insert: {
                    "answered_at"?: string,"attempt_id": string,"flagged"?: boolean,"graded_by"?: string | null,"grader_feedback"?: string | null,"is_correct"?: boolean | null,"marks_awarded"?: number | null,"question_id": string,"response"?: Json | null,"tenant_id": string,"time_spent_seconds"?: number
                  }
                  Update: {
                    "answered_at"?: string,"attempt_id"?: string,"flagged"?: boolean,"graded_by"?: string | null,"grader_feedback"?: string | null,"is_correct"?: boolean | null,"marks_awarded"?: number | null,"question_id"?: string,"response"?: Json | null,"tenant_id"?: string,"time_spent_seconds"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "attempt_answers_tenant_id_attempt_id_fkey"
      columns: ["tenant_id","attempt_id"]
isOneToOne: false
      referencedRelation: "test_attempts"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"attendance_records": {
                  Row: {
                    "duration_seconds": number | null,"joined_at": string | null,"left_at": string | null,"live_session_id": string,"marked_by": string | null,"member_id": string,"note": string | null,"source": string,"status": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "duration_seconds"?: number | null,"joined_at"?: string | null,"left_at"?: string | null,"live_session_id": string,"marked_by"?: string | null,"member_id": string,"note"?: string | null,"source"?: string,"status": string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "duration_seconds"?: number | null,"joined_at"?: string | null,"left_at"?: string | null,"live_session_id"?: string,"marked_by"?: string | null,"member_id"?: string,"note"?: string | null,"source"?: string,"status"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_records_tenant_id_live_session_id_fkey"
      columns: ["tenant_id","live_session_id"]
isOneToOne: false
      referencedRelation: "live_sessions"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "attendance_records_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_member_id": string | null,"actor_user_id": string | null,"changes": Json | null,"entity_id": string | null,"entity_type": string | null,"id": string,"impersonated_by": string | null,"ip": unknown,"occurred_at": string,"tenant_id": string,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_member_id"?: string | null,"actor_user_id"?: string | null,"changes"?: Json | null,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"impersonated_by"?: string | null,"ip"?: unknown,"occurred_at"?: string,"tenant_id": string,"user_agent"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_member_id"?: string | null,"actor_user_id"?: string | null,"changes"?: Json | null,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"impersonated_by"?: string | null,"ip"?: unknown,"occurred_at"?: string,"tenant_id"?: string,"user_agent"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"audit_logs_202610": {
                  Row: {
                    "action": string,"actor_member_id": string | null,"actor_user_id": string | null,"changes": Json | null,"entity_id": string | null,"entity_type": string | null,"id": string,"impersonated_by": string | null,"ip": unknown,"occurred_at": string,"tenant_id": string,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_member_id"?: string | null,"actor_user_id"?: string | null,"changes"?: Json | null,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"impersonated_by"?: string | null,"ip"?: unknown,"occurred_at"?: string,"tenant_id": string,"user_agent"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_member_id"?: string | null,"actor_user_id"?: string | null,"changes"?: Json | null,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"impersonated_by"?: string | null,"ip"?: unknown,"occurred_at"?: string,"tenant_id"?: string,"user_agent"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"audit_logs_202611": {
                  Row: {
                    "action": string,"actor_member_id": string | null,"actor_user_id": string | null,"changes": Json | null,"entity_id": string | null,"entity_type": string | null,"id": string,"impersonated_by": string | null,"ip": unknown,"occurred_at": string,"tenant_id": string,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_member_id"?: string | null,"actor_user_id"?: string | null,"changes"?: Json | null,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"impersonated_by"?: string | null,"ip"?: unknown,"occurred_at"?: string,"tenant_id": string,"user_agent"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_member_id"?: string | null,"actor_user_id"?: string | null,"changes"?: Json | null,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"impersonated_by"?: string | null,"ip"?: unknown,"occurred_at"?: string,"tenant_id"?: string,"user_agent"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"audit_logs_202612": {
                  Row: {
                    "action": string,"actor_member_id": string | null,"actor_user_id": string | null,"changes": Json | null,"entity_id": string | null,"entity_type": string | null,"id": string,"impersonated_by": string | null,"ip": unknown,"occurred_at": string,"tenant_id": string,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_member_id"?: string | null,"actor_user_id"?: string | null,"changes"?: Json | null,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"impersonated_by"?: string | null,"ip"?: unknown,"occurred_at"?: string,"tenant_id": string,"user_agent"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_member_id"?: string | null,"actor_user_id"?: string | null,"changes"?: Json | null,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"impersonated_by"?: string | null,"ip"?: unknown,"occurred_at"?: string,"tenant_id"?: string,"user_agent"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"audit_logs_202701": {
                  Row: {
                    "action": string,"actor_member_id": string | null,"actor_user_id": string | null,"changes": Json | null,"entity_id": string | null,"entity_type": string | null,"id": string,"impersonated_by": string | null,"ip": unknown,"occurred_at": string,"tenant_id": string,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_member_id"?: string | null,"actor_user_id"?: string | null,"changes"?: Json | null,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"impersonated_by"?: string | null,"ip"?: unknown,"occurred_at"?: string,"tenant_id": string,"user_agent"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_member_id"?: string | null,"actor_user_id"?: string | null,"changes"?: Json | null,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"impersonated_by"?: string | null,"ip"?: unknown,"occurred_at"?: string,"tenant_id"?: string,"user_agent"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"audit_logs_202702": {
                  Row: {
                    "action": string,"actor_member_id": string | null,"actor_user_id": string | null,"changes": Json | null,"entity_id": string | null,"entity_type": string | null,"id": string,"impersonated_by": string | null,"ip": unknown,"occurred_at": string,"tenant_id": string,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_member_id"?: string | null,"actor_user_id"?: string | null,"changes"?: Json | null,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"impersonated_by"?: string | null,"ip"?: unknown,"occurred_at"?: string,"tenant_id": string,"user_agent"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_member_id"?: string | null,"actor_user_id"?: string | null,"changes"?: Json | null,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"impersonated_by"?: string | null,"ip"?: unknown,"occurred_at"?: string,"tenant_id"?: string,"user_agent"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"audit_logs_default": {
                  Row: {
                    "action": string,"actor_member_id": string | null,"actor_user_id": string | null,"changes": Json | null,"entity_id": string | null,"entity_type": string | null,"id": string,"impersonated_by": string | null,"ip": unknown,"occurred_at": string,"tenant_id": string,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_member_id"?: string | null,"actor_user_id"?: string | null,"changes"?: Json | null,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"impersonated_by"?: string | null,"ip"?: unknown,"occurred_at"?: string,"tenant_id": string,"user_agent"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_member_id"?: string | null,"actor_user_id"?: string | null,"changes"?: Json | null,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"impersonated_by"?: string | null,"ip"?: unknown,"occurred_at"?: string,"tenant_id"?: string,"user_agent"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"badges": {
                  Row: {
                    "created_at": string,"criteria": Json | null,"description": string | null,"icon_path": string | null,"id": string,"is_active": boolean,"is_secret": boolean,"key": string,"name": string,"tenant_id": string,"tier": string,"updated_at": string,"xp_reward": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"criteria"?: Json | null,"description"?: string | null,"icon_path"?: string | null,"id"?: string,"is_active"?: boolean,"is_secret"?: boolean,"key": string,"name": string,"tenant_id": string,"tier"?: string,"updated_at"?: string,"xp_reward"?: number
                  }
                  Update: {
                    "created_at"?: string,"criteria"?: Json | null,"description"?: string | null,"icon_path"?: string | null,"id"?: string,"is_active"?: boolean,"is_secret"?: boolean,"key"?: string,"name"?: string,"tenant_id"?: string,"tier"?: string,"updated_at"?: string,"xp_reward"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "badges_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"batch_content_releases": {
                  Row: {
                    "batch_id": string,"id": string,"lesson_id": string | null,"release_at": string,"released_by": string | null,"section_id": string | null,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_id": string,"id"?: string,"lesson_id"?: string | null,"release_at"?: string,"released_by"?: string | null,"section_id"?: string | null,"tenant_id": string
                  }
                  Update: {
                    "batch_id"?: string,"id"?: string,"lesson_id"?: string | null,"release_at"?: string,"released_by"?: string | null,"section_id"?: string | null,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "batch_content_releases_tenant_id_batch_id_fkey"
      columns: ["tenant_id","batch_id"]
isOneToOne: false
      referencedRelation: "batches"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "batch_content_releases_tenant_id_lesson_id_fkey"
      columns: ["tenant_id","lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "batch_content_releases_tenant_id_section_id_fkey"
      columns: ["tenant_id","section_id"]
isOneToOne: false
      referencedRelation: "course_sections"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"batch_courses": {
                  Row: {
                    "batch_id": string,"course_id": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_id": string,"course_id": string,"tenant_id": string
                  }
                  Update: {
                    "batch_id"?: string,"course_id"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "batch_courses_tenant_id_batch_id_fkey"
      columns: ["tenant_id","batch_id"]
isOneToOne: false
      referencedRelation: "batches"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "batch_courses_tenant_id_course_id_fkey"
      columns: ["tenant_id","course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"batch_instructors": {
                  Row: {
                    "batch_id": string,"course_id": string | null,"id": string,"member_id": string,"role": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_id": string,"course_id"?: string | null,"id"?: string,"member_id": string,"role"?: string,"tenant_id": string
                  }
                  Update: {
                    "batch_id"?: string,"course_id"?: string | null,"id"?: string,"member_id"?: string,"role"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "batch_instructors_tenant_id_batch_id_fkey"
      columns: ["tenant_id","batch_id"]
isOneToOne: false
      referencedRelation: "batches"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "batch_instructors_tenant_id_course_id_fkey"
      columns: ["tenant_id","course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "batch_instructors_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"batches": {
                  Row: {
                    "branch_id": string | null,"capacity": number | null,"code": string,"created_at": string,"end_date": string | null,"id": string,"mode": string,"name": string,"schedule": NonNullable<Json>,"settings": NonNullable<Json>,"start_date": string | null,"status": string,"tenant_id": string,"timezone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id"?: string | null,"capacity"?: number | null,"code": string,"created_at"?: string,"end_date"?: string | null,"id"?: string,"mode"?: string,"name": string,"schedule"?: NonNullable<Json>,"settings"?: NonNullable<Json>,"start_date"?: string | null,"status"?: string,"tenant_id": string,"timezone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "branch_id"?: string | null,"capacity"?: number | null,"code"?: string,"created_at"?: string,"end_date"?: string | null,"id"?: string,"mode"?: string,"name"?: string,"schedule"?: NonNullable<Json>,"settings"?: NonNullable<Json>,"start_date"?: string | null,"status"?: string,"tenant_id"?: string,"timezone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "batches_tenant_id_branch_id_fkey"
      columns: ["tenant_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "batches_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"blog_posts": {
                  Row: {
                    "author_member_id": string | null,"body": NonNullable<Json>,"cover_path": string | null,"created_at": string,"excerpt": string | null,"id": string,"published_at": string | null,"seo": NonNullable<Json>,"slug": string,"status": string,"tags": (string)[],"tenant_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_member_id"?: string | null,"body": NonNullable<Json>,"cover_path"?: string | null,"created_at"?: string,"excerpt"?: string | null,"id"?: string,"published_at"?: string | null,"seo"?: NonNullable<Json>,"slug": string,"status"?: string,"tags"?: (string)[],"tenant_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "author_member_id"?: string | null,"body"?: NonNullable<Json>,"cover_path"?: string | null,"created_at"?: string,"excerpt"?: string | null,"id"?: string,"published_at"?: string | null,"seo"?: NonNullable<Json>,"slug"?: string,"status"?: string,"tags"?: (string)[],"tenant_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blog_posts_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"branches": {
                  Row: {
                    "address": NonNullable<Json>,"city": string | null,"code": string,"created_at": string,"id": string,"is_active": boolean,"name": string,"phone": string | null,"state": string | null,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: NonNullable<Json>,"city"?: string | null,"code": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"phone"?: string | null,"state"?: string | null,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "address"?: NonNullable<Json>,"city"?: string | null,"code"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"phone"?: string | null,"state"?: string | null,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "branches_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"certificate_templates": {
                  Row: {
                    "background_path": string | null,"created_at": string,"id": string,"is_default": boolean,"layout": NonNullable<Json>,"name": string,"orientation": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "background_path"?: string | null,"created_at"?: string,"id"?: string,"is_default"?: boolean,"layout"?: NonNullable<Json>,"name": string,"orientation"?: string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "background_path"?: string | null,"created_at"?: string,"id"?: string,"is_default"?: boolean,"layout"?: NonNullable<Json>,"name"?: string,"orientation"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "certificate_templates_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"certificates": {
                  Row: {
                    "course_id": string | null,"data": NonNullable<Json>,"enrollment_id": string | null,"id": string,"issued_at": string,"member_id": string,"pdf_path": string | null,"recipient_name": string,"revoke_reason": string | null,"revoked_at": string | null,"serial_no": string,"template_id": string | null,"tenant_id": string,"title": string,"verification_code": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id"?: string | null,"data"?: NonNullable<Json>,"enrollment_id"?: string | null,"id"?: string,"issued_at"?: string,"member_id": string,"pdf_path"?: string | null,"recipient_name": string,"revoke_reason"?: string | null,"revoked_at"?: string | null,"serial_no": string,"template_id"?: string | null,"tenant_id": string,"title": string,"verification_code": string
                  }
                  Update: {
                    "course_id"?: string | null,"data"?: NonNullable<Json>,"enrollment_id"?: string | null,"id"?: string,"issued_at"?: string,"member_id"?: string,"pdf_path"?: string | null,"recipient_name"?: string,"revoke_reason"?: string | null,"revoked_at"?: string | null,"serial_no"?: string,"template_id"?: string | null,"tenant_id"?: string,"title"?: string,"verification_code"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "certificates_tenant_id_course_id_fkey"
      columns: ["tenant_id","course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "certificates_tenant_id_enrollment_id_fkey"
      columns: ["tenant_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "certificates_tenant_id_enrollment_id_fkey"
      columns: ["tenant_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "v_enrollment_overview"
      referencedColumns: ["tenant_id","enrollment_id"]
    },{
      foreignKeyName: "certificates_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "certificates_tenant_id_template_id_fkey"
      columns: ["tenant_id","template_id"]
isOneToOne: false
      referencedRelation: "certificate_templates"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"consents": {
                  Row: {
                    "evidence": NonNullable<Json>,"granted_at": string,"guardian_member_id": string | null,"id": string,"member_id": string,"policy_version": string,"purpose": string,"tenant_id": string,"withdrawn_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "evidence"?: NonNullable<Json>,"granted_at"?: string,"guardian_member_id"?: string | null,"id"?: string,"member_id": string,"policy_version": string,"purpose": string,"tenant_id": string,"withdrawn_at"?: string | null
                  }
                  Update: {
                    "evidence"?: NonNullable<Json>,"granted_at"?: string,"guardian_member_id"?: string | null,"id"?: string,"member_id"?: string,"policy_version"?: string,"purpose"?: string,"tenant_id"?: string,"withdrawn_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "consents_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"content_reports": {
                  Row: {
                    "created_at": string,"id": string,"reason": string,"reporter_id": string,"resolved_at": string | null,"resolved_by": string | null,"status": string,"target_id": string,"target_type": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"reason": string,"reporter_id": string,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string,"target_id": string,"target_type": string,"tenant_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"reason"?: string,"reporter_id"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string,"target_id"?: string,"target_type"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_reports_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"coupon_redemptions": {
                  Row: {
                    "coupon_id": string,"discount_minor": number,"member_id": string,"order_id": string,"redeemed_at": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "coupon_id": string,"discount_minor": number,"member_id": string,"order_id": string,"redeemed_at"?: string,"tenant_id": string
                  }
                  Update: {
                    "coupon_id"?: string,"discount_minor"?: number,"member_id"?: string,"order_id"?: string,"redeemed_at"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "coupon_redemptions_tenant_id_coupon_id_fkey"
      columns: ["tenant_id","coupon_id"]
isOneToOne: false
      referencedRelation: "coupons"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "coupon_redemptions_tenant_id_order_id_fkey"
      columns: ["tenant_id","order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"coupons": {
                  Row: {
                    "affiliate_id": string | null,"applies_to": NonNullable<Json>,"code": string,"created_at": string,"description": string | null,"discount_type": string,"discount_value": number,"ends_at": string | null,"id": string,"is_active": boolean,"max_discount_minor": number | null,"max_redemptions": number | null,"min_order_minor": number | null,"per_member_limit": number,"redeemed_count": number,"starts_at": string | null,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "affiliate_id"?: string | null,"applies_to"?: NonNullable<Json>,"code": string,"created_at"?: string,"description"?: string | null,"discount_type": string,"discount_value": number,"ends_at"?: string | null,"id"?: string,"is_active"?: boolean,"max_discount_minor"?: number | null,"max_redemptions"?: number | null,"min_order_minor"?: number | null,"per_member_limit"?: number,"redeemed_count"?: number,"starts_at"?: string | null,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "affiliate_id"?: string | null,"applies_to"?: NonNullable<Json>,"code"?: string,"created_at"?: string,"description"?: string | null,"discount_type"?: string,"discount_value"?: number,"ends_at"?: string | null,"id"?: string,"is_active"?: boolean,"max_discount_minor"?: number | null,"max_redemptions"?: number | null,"min_order_minor"?: number | null,"per_member_limit"?: number,"redeemed_count"?: number,"starts_at"?: string | null,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "coupons_affiliate_fk"
      columns: ["tenant_id","affiliate_id"]
isOneToOne: false
      referencedRelation: "affiliates"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "coupons_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"course_instructors": {
                  Row: {
                    "course_id": string,"member_id": string,"role": string,"sort_order": number,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"member_id": string,"role"?: string,"sort_order"?: number,"tenant_id": string
                  }
                  Update: {
                    "course_id"?: string,"member_id"?: string,"role"?: string,"sort_order"?: number,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "course_instructors_tenant_id_course_id_fkey"
      columns: ["tenant_id","course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "course_instructors_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"course_sections": {
                  Row: {
                    "course_id": string,"created_at": string,"deleted_at": string | null,"description": string | null,"id": string,"is_published": boolean,"label": string | null,"parent_id": string | null,"position": number,"tenant_id": string,"title": string,"unlock_rule": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"id"?: string,"is_published"?: boolean,"label"?: string | null,"parent_id"?: string | null,"position"?: number,"tenant_id": string,"title": string,"unlock_rule"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "course_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"id"?: string,"is_published"?: boolean,"label"?: string | null,"parent_id"?: string | null,"position"?: number,"tenant_id"?: string,"title"?: string,"unlock_rule"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "course_sections_course_id_parent_id_fkey"
      columns: ["course_id","parent_id"]
isOneToOne: false
      referencedRelation: "course_sections"
      referencedColumns: ["course_id","id"]
    },{
      foreignKeyName: "course_sections_tenant_id_course_id_fkey"
      columns: ["tenant_id","course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"courses": {
                  Row: {
                    "access_duration_days": number | null,"category_term_id": string | null,"cover_path": string | null,"created_at": string,"created_by": string | null,"custom_fields": NonNullable<Json>,"deleted_at": string | null,"delivery_mode": string,"description": Json | null,"estimated_minutes": number | null,"id": string,"kind": string,"language": string,"lesson_count": number,"level": string,"outcomes": (string)[],"published_at": string | null,"requirements": (string)[],"search_vector": unknown,"seo": NonNullable<Json>,"settings": NonNullable<Json>,"slug": string,"sort_order": number,"status": string,"subtitle": string | null,"summary": string | null,"tags": (string)[],"tenant_id": string,"title": string,"trailer_media_id": string | null,"updated_at": string,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "access_duration_days"?: number | null,"category_term_id"?: string | null,"cover_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"custom_fields"?: NonNullable<Json>,"deleted_at"?: string | null,"delivery_mode"?: string,"description"?: Json | null,"estimated_minutes"?: number | null,"id"?: string,"kind"?: string,"language"?: string,"lesson_count"?: number,"level"?: string,"outcomes"?: (string)[],"published_at"?: string | null,"requirements"?: (string)[],"search_vector"?: never,"seo"?: NonNullable<Json>,"settings"?: NonNullable<Json>,"slug": string,"sort_order"?: number,"status"?: string,"subtitle"?: string | null,"summary"?: string | null,"tags"?: (string)[],"tenant_id": string,"title": string,"trailer_media_id"?: string | null,"updated_at"?: string,"visibility"?: string
                  }
                  Update: {
                    "access_duration_days"?: number | null,"category_term_id"?: string | null,"cover_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"custom_fields"?: NonNullable<Json>,"deleted_at"?: string | null,"delivery_mode"?: string,"description"?: Json | null,"estimated_minutes"?: number | null,"id"?: string,"kind"?: string,"language"?: string,"lesson_count"?: number,"level"?: string,"outcomes"?: (string)[],"published_at"?: string | null,"requirements"?: (string)[],"search_vector"?: never,"seo"?: NonNullable<Json>,"settings"?: NonNullable<Json>,"slug"?: string,"sort_order"?: number,"status"?: string,"subtitle"?: string | null,"summary"?: string | null,"tags"?: (string)[],"tenant_id"?: string,"title"?: string,"trailer_media_id"?: string | null,"updated_at"?: string,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "courses_tenant_id_category_term_id_fkey"
      columns: ["tenant_id","category_term_id"]
isOneToOne: false
      referencedRelation: "taxonomy_terms"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "courses_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "courses_tenant_id_trailer_media_id_fkey"
      columns: ["tenant_id","trailer_media_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"custom_field_definitions": {
                  Row: {
                    "created_at": string,"editable_by": string,"entity": string,"field_type": string,"id": string,"is_required": boolean,"key": string,"label": string,"options": NonNullable<Json>,"sort_order": number,"tenant_id": string,"updated_at": string,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"editable_by"?: string,"entity": string,"field_type": string,"id"?: string,"is_required"?: boolean,"key": string,"label": string,"options"?: NonNullable<Json>,"sort_order"?: number,"tenant_id": string,"updated_at"?: string,"visibility"?: string
                  }
                  Update: {
                    "created_at"?: string,"editable_by"?: string,"entity"?: string,"field_type"?: string,"id"?: string,"is_required"?: boolean,"key"?: string,"label"?: string,"options"?: NonNullable<Json>,"sort_order"?: number,"tenant_id"?: string,"updated_at"?: string,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "custom_field_definitions_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"daily_activity": {
                  Row: {
                    "active_seconds": number,"day": string,"lessons_completed": number,"member_id": string,"tenant_id": string,"tests_submitted": number,"xp_earned": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active_seconds"?: number,"day": string,"lessons_completed"?: number,"member_id": string,"tenant_id": string,"tests_submitted"?: number,"xp_earned"?: number
                  }
                  Update: {
                    "active_seconds"?: number,"day"?: string,"lessons_completed"?: number,"member_id"?: string,"tenant_id"?: string,"tests_submitted"?: number,"xp_earned"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_activity_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"data_subject_requests": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"details": string | null,"due_at": string | null,"id": string,"member_id": string | null,"request_type": string,"resolution": string | null,"status": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"details"?: string | null,"due_at"?: string | null,"id"?: string,"member_id"?: string | null,"request_type": string,"resolution"?: string | null,"status"?: string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"details"?: string | null,"due_at"?: string | null,"id"?: string,"member_id"?: string | null,"request_type"?: string,"resolution"?: string | null,"status"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "data_subject_requests_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"discussion_posts": {
                  Row: {
                    "attachments": (string)[],"author_member_id": string,"body": NonNullable<Json>,"created_at": string,"id": string,"is_accepted_answer": boolean,"is_staff_answer": boolean,"parent_id": string | null,"status": string,"tenant_id": string,"thread_id": string,"updated_at": string,"upvotes": number
                  }
                  ComputedFields: never
                  Insert: {
                    "attachments"?: (string)[],"author_member_id": string,"body": NonNullable<Json>,"created_at"?: string,"id"?: string,"is_accepted_answer"?: boolean,"is_staff_answer"?: boolean,"parent_id"?: string | null,"status"?: string,"tenant_id": string,"thread_id": string,"updated_at"?: string,"upvotes"?: number
                  }
                  Update: {
                    "attachments"?: (string)[],"author_member_id"?: string,"body"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"is_accepted_answer"?: boolean,"is_staff_answer"?: boolean,"parent_id"?: string | null,"status"?: string,"tenant_id"?: string,"thread_id"?: string,"updated_at"?: string,"upvotes"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "discussion_posts_tenant_id_author_member_id_fkey"
      columns: ["tenant_id","author_member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "discussion_posts_tenant_id_parent_id_fkey"
      columns: ["tenant_id","parent_id"]
isOneToOne: false
      referencedRelation: "discussion_posts"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "discussion_posts_tenant_id_thread_id_fkey"
      columns: ["tenant_id","thread_id"]
isOneToOne: false
      referencedRelation: "discussion_threads"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"discussion_threads": {
                  Row: {
                    "assigned_to": string | null,"attachments": (string)[],"author_member_id": string,"body": NonNullable<Json>,"context_id": string | null,"context_type": string,"created_at": string,"id": string,"is_pinned": boolean,"kind": string,"last_activity_at": string,"replies_count": number,"sla_due_at": string | null,"status": string,"tenant_id": string,"title": string,"updated_at": string,"upvotes": number
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_to"?: string | null,"attachments"?: (string)[],"author_member_id": string,"body": NonNullable<Json>,"context_id"?: string | null,"context_type": string,"created_at"?: string,"id"?: string,"is_pinned"?: boolean,"kind"?: string,"last_activity_at"?: string,"replies_count"?: number,"sla_due_at"?: string | null,"status"?: string,"tenant_id": string,"title": string,"updated_at"?: string,"upvotes"?: number
                  }
                  Update: {
                    "assigned_to"?: string | null,"attachments"?: (string)[],"author_member_id"?: string,"body"?: NonNullable<Json>,"context_id"?: string | null,"context_type"?: string,"created_at"?: string,"id"?: string,"is_pinned"?: boolean,"kind"?: string,"last_activity_at"?: string,"replies_count"?: number,"sla_due_at"?: string | null,"status"?: string,"tenant_id"?: string,"title"?: string,"updated_at"?: string,"upvotes"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "discussion_threads_tenant_id_assigned_to_fkey"
      columns: ["tenant_id","assigned_to"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "discussion_threads_tenant_id_author_member_id_fkey"
      columns: ["tenant_id","author_member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "discussion_threads_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"enrollments": {
                  Row: {
                    "batch_id": string | null,"certificate_id": string | null,"completed_at": string | null,"course_id": string,"created_at": string,"expires_at": string | null,"id": string,"last_activity_at": string | null,"last_lesson_id": string | null,"lessons_completed": number,"lessons_total": number,"member_id": string,"notes": string | null,"order_item_id": string | null,"progress_pct": number,"source": string,"started_at": string,"status": string,"tenant_id": string,"total_time_seconds": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_id"?: string | null,"certificate_id"?: string | null,"completed_at"?: string | null,"course_id": string,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"last_activity_at"?: string | null,"last_lesson_id"?: string | null,"lessons_completed"?: number,"lessons_total"?: number,"member_id": string,"notes"?: string | null,"order_item_id"?: string | null,"progress_pct"?: number,"source": string,"started_at"?: string,"status"?: string,"tenant_id": string,"total_time_seconds"?: number,"updated_at"?: string
                  }
                  Update: {
                    "batch_id"?: string | null,"certificate_id"?: string | null,"completed_at"?: string | null,"course_id"?: string,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"last_activity_at"?: string | null,"last_lesson_id"?: string | null,"lessons_completed"?: number,"lessons_total"?: number,"member_id"?: string,"notes"?: string | null,"order_item_id"?: string | null,"progress_pct"?: number,"source"?: string,"started_at"?: string,"status"?: string,"tenant_id"?: string,"total_time_seconds"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "enrollments_certificate_fk"
      columns: ["tenant_id","certificate_id"]
isOneToOne: false
      referencedRelation: "certificates"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "enrollments_order_item_fk"
      columns: ["tenant_id","order_item_id"]
isOneToOne: false
      referencedRelation: "order_items"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "enrollments_tenant_id_batch_id_fkey"
      columns: ["tenant_id","batch_id"]
isOneToOne: false
      referencedRelation: "batches"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "enrollments_tenant_id_course_id_fkey"
      columns: ["tenant_id","course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "enrollments_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"faqs": {
                  Row: {
                    "answer": NonNullable<Json>,"context_id": string | null,"context_type": string,"id": string,"is_published": boolean,"position": number,"question": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer": NonNullable<Json>,"context_id"?: string | null,"context_type"?: string,"id"?: string,"is_published"?: boolean,"position"?: number,"question": string,"tenant_id": string
                  }
                  Update: {
                    "answer"?: NonNullable<Json>,"context_id"?: string | null,"context_type"?: string,"id"?: string,"is_published"?: boolean,"position"?: number,"question"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "faqs_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"form_submissions": {
                  Row: {
                    "created_at": string,"data": NonNullable<Json>,"form_id": string,"id": string,"ip": unknown,"lead_id": string | null,"tenant_id": string,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"data": NonNullable<Json>,"form_id": string,"id"?: string,"ip"?: unknown,"lead_id"?: string | null,"tenant_id": string,"user_agent"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"data"?: NonNullable<Json>,"form_id"?: string,"id"?: string,"ip"?: unknown,"lead_id"?: string | null,"tenant_id"?: string,"user_agent"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "form_submissions_tenant_id_form_id_fkey"
      columns: ["tenant_id","form_id"]
isOneToOne: false
      referencedRelation: "forms"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "form_submissions_tenant_id_lead_id_fkey"
      columns: ["tenant_id","lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"forms": {
                  Row: {
                    "created_at": string,"creates_lead": boolean,"fields": NonNullable<Json>,"id": string,"is_active": boolean,"key": string,"name": string,"notify_emails": (string)[],"success_message": string | null,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"creates_lead"?: boolean,"fields"?: NonNullable<Json>,"id"?: string,"is_active"?: boolean,"key": string,"name": string,"notify_emails"?: (string)[],"success_message"?: string | null,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"creates_lead"?: boolean,"fields"?: NonNullable<Json>,"id"?: string,"is_active"?: boolean,"key"?: string,"name"?: string,"notify_emails"?: (string)[],"success_message"?: string | null,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "forms_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"gateway_webhook_inbox": {
                  Row: {
                    "attempts": number,"event_id": string,"event_type": string,"gateway": string,"id": string,"last_error": string | null,"payload": NonNullable<Json>,"processed_at": string | null,"received_at": string,"tenant_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"event_id": string,"event_type": string,"gateway": string,"id"?: string,"last_error"?: string | null,"payload": NonNullable<Json>,"processed_at"?: string | null,"received_at"?: string,"tenant_id"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"event_id"?: string,"event_type"?: string,"gateway"?: string,"id"?: string,"last_error"?: string | null,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"received_at"?: string,"tenant_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "gateway_webhook_inbox_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"guardian_links": {
                  Row: {
                    "created_at": string,"guardian_member_id": string,"permissions": NonNullable<Json>,"relation": string,"student_member_id": string,"tenant_id": string,"verified_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"guardian_member_id": string,"permissions"?: NonNullable<Json>,"relation"?: string,"student_member_id": string,"tenant_id": string,"verified_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"guardian_member_id"?: string,"permissions"?: NonNullable<Json>,"relation"?: string,"student_member_id"?: string,"tenant_id"?: string,"verified_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "guardian_links_tenant_id_guardian_member_id_fkey"
      columns: ["tenant_id","guardian_member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "guardian_links_tenant_id_student_member_id_fkey"
      columns: ["tenant_id","student_member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"import_jobs": {
                  Row: {
                    "created_at": string,"created_by": string | null,"entity": string,"error_report_path": string | null,"error_rows": number,"file_path": string,"finished_at": string | null,"id": string,"mapping": NonNullable<Json>,"status": string,"success_rows": number,"tenant_id": string,"total_rows": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"entity": string,"error_report_path"?: string | null,"error_rows"?: number,"file_path": string,"finished_at"?: string | null,"id"?: string,"mapping"?: NonNullable<Json>,"status"?: string,"success_rows"?: number,"tenant_id": string,"total_rows"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"entity"?: string,"error_report_path"?: string | null,"error_rows"?: number,"file_path"?: string,"finished_at"?: string | null,"id"?: string,"mapping"?: NonNullable<Json>,"status"?: string,"success_rows"?: number,"tenant_id"?: string,"total_rows"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "import_jobs_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"installments": {
                  Row: {
                    "amount_minor": number,"due_date": string,"id": string,"order_id": string,"paid_at": string | null,"reminder_count": number,"seq": number,"status": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"due_date": string,"id"?: string,"order_id": string,"paid_at"?: string | null,"reminder_count"?: number,"seq": number,"status"?: string,"tenant_id": string
                  }
                  Update: {
                    "amount_minor"?: number,"due_date"?: string,"id"?: string,"order_id"?: string,"paid_at"?: string | null,"reminder_count"?: number,"seq"?: number,"status"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "installments_tenant_id_order_id_fkey"
      columns: ["tenant_id","order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"instructor_profiles": {
                  Row: {
                    "bio": Json | null,"credentials": NonNullable<Json>,"experience_years": number | null,"expertise": (string)[],"headline": string | null,"is_public": boolean,"member_id": string,"social": NonNullable<Json>,"sort_order": number,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bio"?: Json | null,"credentials"?: NonNullable<Json>,"experience_years"?: number | null,"expertise"?: (string)[],"headline"?: string | null,"is_public"?: boolean,"member_id": string,"social"?: NonNullable<Json>,"sort_order"?: number,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "bio"?: Json | null,"credentials"?: NonNullable<Json>,"experience_years"?: number | null,"expertise"?: (string)[],"headline"?: string | null,"is_public"?: boolean,"member_id"?: string,"social"?: NonNullable<Json>,"sort_order"?: number,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "instructor_profiles_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"integrations": {
                  Row: {
                    "config": NonNullable<Json>,"connected_by": string | null,"created_at": string,"id": string,"last_error": string | null,"provider": string,"secret_vault_id": string | null,"status": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "config"?: NonNullable<Json>,"connected_by"?: string | null,"created_at"?: string,"id"?: string,"last_error"?: string | null,"provider": string,"secret_vault_id"?: string | null,"status"?: string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "config"?: NonNullable<Json>,"connected_by"?: string | null,"created_at"?: string,"id"?: string,"last_error"?: string | null,"provider"?: string,"secret_vault_id"?: string | null,"status"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "integrations_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"email": string | null,"expires_at": string,"id": string,"invited_by": string | null,"phone": string | null,"revoked_at": string | null,"role_key": string,"scope_id": string | null,"scope_type": string,"tenant_id": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"email"?: string | null,"expires_at": string,"id"?: string,"invited_by"?: string | null,"phone"?: string | null,"revoked_at"?: string | null,"role_key": string,"scope_id"?: string | null,"scope_type"?: string,"tenant_id": string,"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"email"?: string | null,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"phone"?: string | null,"revoked_at"?: string | null,"role_key"?: string,"scope_id"?: string | null,"scope_type"?: string,"tenant_id"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "buyer": NonNullable<Json>,"created_at": string,"id": string,"invoice_no": string,"issued_at": string,"kind": string,"lines": NonNullable<Json>,"order_id": string,"pdf_path": string | null,"seller": NonNullable<Json>,"tenant_id": string,"totals": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "buyer": NonNullable<Json>,"created_at"?: string,"id"?: string,"invoice_no": string,"issued_at"?: string,"kind"?: string,"lines": NonNullable<Json>,"order_id": string,"pdf_path"?: string | null,"seller": NonNullable<Json>,"tenant_id": string,"totals": NonNullable<Json>
                  }
                  Update: {
                    "buyer"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"invoice_no"?: string,"issued_at"?: string,"kind"?: string,"lines"?: NonNullable<Json>,"order_id"?: string,"pdf_path"?: string | null,"seller"?: NonNullable<Json>,"tenant_id"?: string,"totals"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_tenant_id_order_id_fkey"
      columns: ["tenant_id","order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"lead_activities": {
                  Row: {
                    "body": string | null,"by_member_id": string | null,"created_at": string,"done_at": string | null,"id": string,"lead_id": string,"scheduled_at": string | null,"tenant_id": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"by_member_id"?: string | null,"created_at"?: string,"done_at"?: string | null,"id"?: string,"lead_id": string,"scheduled_at"?: string | null,"tenant_id": string,"type": string
                  }
                  Update: {
                    "body"?: string | null,"by_member_id"?: string | null,"created_at"?: string,"done_at"?: string | null,"id"?: string,"lead_id"?: string,"scheduled_at"?: string | null,"tenant_id"?: string,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lead_activities_tenant_id_lead_id_fkey"
      columns: ["tenant_id","lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"leaderboard_entries": {
                  Row: {
                    "computed_at": string,"display_name": string | null,"leaderboard_id": string,"member_id": string,"period_key": string,"rank": number,"score": number,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "computed_at"?: string,"display_name"?: string | null,"leaderboard_id": string,"member_id": string,"period_key": string,"rank": number,"score": number,"tenant_id": string
                  }
                  Update: {
                    "computed_at"?: string,"display_name"?: string | null,"leaderboard_id"?: string,"member_id"?: string,"period_key"?: string,"rank"?: number,"score"?: number,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "leaderboard_entries_tenant_id_leaderboard_id_fkey"
      columns: ["tenant_id","leaderboard_id"]
isOneToOne: false
      referencedRelation: "leaderboards"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"leaderboards": {
                  Row: {
                    "anonymize": boolean,"created_at": string,"id": string,"is_active": boolean,"is_public": boolean,"key": string,"metric": string,"name": string,"period": string,"scope_id": string | null,"scope_type": string,"tenant_id": string,"top_n": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anonymize"?: boolean,"created_at"?: string,"id"?: string,"is_active"?: boolean,"is_public"?: boolean,"key": string,"metric"?: string,"name": string,"period"?: string,"scope_id"?: string | null,"scope_type"?: string,"tenant_id": string,"top_n"?: number,"updated_at"?: string
                  }
                  Update: {
                    "anonymize"?: boolean,"created_at"?: string,"id"?: string,"is_active"?: boolean,"is_public"?: boolean,"key"?: string,"metric"?: string,"name"?: string,"period"?: string,"scope_id"?: string | null,"scope_type"?: string,"tenant_id"?: string,"top_n"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "leaderboards_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"leads": {
                  Row: {
                    "branch_id": string | null,"converted_member_id": string | null,"created_at": string,"custom_fields": NonNullable<Json>,"email": string | null,"full_name": string,"id": string,"interested_in": (string)[],"lost_reason": string | null,"next_follow_up_at": string | null,"owner_member_id": string | null,"phone": string | null,"score": number,"source": string,"status": string,"tenant_id": string,"updated_at": string,"utm": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id"?: string | null,"converted_member_id"?: string | null,"created_at"?: string,"custom_fields"?: NonNullable<Json>,"email"?: string | null,"full_name": string,"id"?: string,"interested_in"?: (string)[],"lost_reason"?: string | null,"next_follow_up_at"?: string | null,"owner_member_id"?: string | null,"phone"?: string | null,"score"?: number,"source"?: string,"status"?: string,"tenant_id": string,"updated_at"?: string,"utm"?: NonNullable<Json>
                  }
                  Update: {
                    "branch_id"?: string | null,"converted_member_id"?: string | null,"created_at"?: string,"custom_fields"?: NonNullable<Json>,"email"?: string | null,"full_name"?: string,"id"?: string,"interested_in"?: (string)[],"lost_reason"?: string | null,"next_follow_up_at"?: string | null,"owner_member_id"?: string | null,"phone"?: string | null,"score"?: number,"source"?: string,"status"?: string,"tenant_id"?: string,"updated_at"?: string,"utm"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "leads_tenant_id_branch_id_fkey"
      columns: ["tenant_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "leads_tenant_id_converted_member_id_fkey"
      columns: ["tenant_id","converted_member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "leads_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_tenant_id_owner_member_id_fkey"
      columns: ["tenant_id","owner_member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"learning_events": {
                  Row: {
                    "context": NonNullable<Json>,"id": string,"member_id": string | null,"object_id": string | null,"object_type": string | null,"occurred_at": string,"tenant_id": string,"verb": string
                  }
                  ComputedFields: never
                  Insert: {
                    "context"?: NonNullable<Json>,"id"?: string,"member_id"?: string | null,"object_id"?: string | null,"object_type"?: string | null,"occurred_at"?: string,"tenant_id": string,"verb": string
                  }
                  Update: {
                    "context"?: NonNullable<Json>,"id"?: string,"member_id"?: string | null,"object_id"?: string | null,"object_type"?: string | null,"occurred_at"?: string,"tenant_id"?: string,"verb"?: string
                  }
                  Relationships: [
                    
                  ]
                },"learning_events_202610": {
                  Row: {
                    "context": NonNullable<Json>,"id": string,"member_id": string | null,"object_id": string | null,"object_type": string | null,"occurred_at": string,"tenant_id": string,"verb": string
                  }
                  ComputedFields: never
                  Insert: {
                    "context"?: NonNullable<Json>,"id"?: string,"member_id"?: string | null,"object_id"?: string | null,"object_type"?: string | null,"occurred_at"?: string,"tenant_id": string,"verb": string
                  }
                  Update: {
                    "context"?: NonNullable<Json>,"id"?: string,"member_id"?: string | null,"object_id"?: string | null,"object_type"?: string | null,"occurred_at"?: string,"tenant_id"?: string,"verb"?: string
                  }
                  Relationships: [
                    
                  ]
                },"learning_events_202611": {
                  Row: {
                    "context": NonNullable<Json>,"id": string,"member_id": string | null,"object_id": string | null,"object_type": string | null,"occurred_at": string,"tenant_id": string,"verb": string
                  }
                  ComputedFields: never
                  Insert: {
                    "context"?: NonNullable<Json>,"id"?: string,"member_id"?: string | null,"object_id"?: string | null,"object_type"?: string | null,"occurred_at"?: string,"tenant_id": string,"verb": string
                  }
                  Update: {
                    "context"?: NonNullable<Json>,"id"?: string,"member_id"?: string | null,"object_id"?: string | null,"object_type"?: string | null,"occurred_at"?: string,"tenant_id"?: string,"verb"?: string
                  }
                  Relationships: [
                    
                  ]
                },"learning_events_202612": {
                  Row: {
                    "context": NonNullable<Json>,"id": string,"member_id": string | null,"object_id": string | null,"object_type": string | null,"occurred_at": string,"tenant_id": string,"verb": string
                  }
                  ComputedFields: never
                  Insert: {
                    "context"?: NonNullable<Json>,"id"?: string,"member_id"?: string | null,"object_id"?: string | null,"object_type"?: string | null,"occurred_at"?: string,"tenant_id": string,"verb": string
                  }
                  Update: {
                    "context"?: NonNullable<Json>,"id"?: string,"member_id"?: string | null,"object_id"?: string | null,"object_type"?: string | null,"occurred_at"?: string,"tenant_id"?: string,"verb"?: string
                  }
                  Relationships: [
                    
                  ]
                },"learning_events_202701": {
                  Row: {
                    "context": NonNullable<Json>,"id": string,"member_id": string | null,"object_id": string | null,"object_type": string | null,"occurred_at": string,"tenant_id": string,"verb": string
                  }
                  ComputedFields: never
                  Insert: {
                    "context"?: NonNullable<Json>,"id"?: string,"member_id"?: string | null,"object_id"?: string | null,"object_type"?: string | null,"occurred_at"?: string,"tenant_id": string,"verb": string
                  }
                  Update: {
                    "context"?: NonNullable<Json>,"id"?: string,"member_id"?: string | null,"object_id"?: string | null,"object_type"?: string | null,"occurred_at"?: string,"tenant_id"?: string,"verb"?: string
                  }
                  Relationships: [
                    
                  ]
                },"learning_events_202702": {
                  Row: {
                    "context": NonNullable<Json>,"id": string,"member_id": string | null,"object_id": string | null,"object_type": string | null,"occurred_at": string,"tenant_id": string,"verb": string
                  }
                  ComputedFields: never
                  Insert: {
                    "context"?: NonNullable<Json>,"id"?: string,"member_id"?: string | null,"object_id"?: string | null,"object_type"?: string | null,"occurred_at"?: string,"tenant_id": string,"verb": string
                  }
                  Update: {
                    "context"?: NonNullable<Json>,"id"?: string,"member_id"?: string | null,"object_id"?: string | null,"object_type"?: string | null,"occurred_at"?: string,"tenant_id"?: string,"verb"?: string
                  }
                  Relationships: [
                    
                  ]
                },"learning_events_default": {
                  Row: {
                    "context": NonNullable<Json>,"id": string,"member_id": string | null,"object_id": string | null,"object_type": string | null,"occurred_at": string,"tenant_id": string,"verb": string
                  }
                  ComputedFields: never
                  Insert: {
                    "context"?: NonNullable<Json>,"id"?: string,"member_id"?: string | null,"object_id"?: string | null,"object_type"?: string | null,"occurred_at"?: string,"tenant_id": string,"verb": string
                  }
                  Update: {
                    "context"?: NonNullable<Json>,"id"?: string,"member_id"?: string | null,"object_id"?: string | null,"object_type"?: string | null,"occurred_at"?: string,"tenant_id"?: string,"verb"?: string
                  }
                  Relationships: [
                    
                  ]
                },"lesson_notes": {
                  Row: {
                    "body": string | null,"created_at": string,"id": string,"kind": string,"lesson_id": string,"member_id": string,"page_no": number | null,"position_seconds": number | null,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"lesson_id": string,"member_id": string,"page_no"?: number | null,"position_seconds"?: number | null,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"lesson_id"?: string,"member_id"?: string,"page_no"?: number | null,"position_seconds"?: number | null,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lesson_notes_tenant_id_lesson_id_fkey"
      columns: ["tenant_id","lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "lesson_notes_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"lesson_progress": {
                  Row: {
                    "completed_at": string | null,"course_id": string,"enrollment_id": string,"first_viewed_at": string,"last_position_seconds": number,"last_viewed_at": string,"lesson_id": string,"member_id": string,"progress_pct": number,"status": string,"tenant_id": string,"time_spent_seconds": number,"view_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"course_id": string,"enrollment_id": string,"first_viewed_at"?: string,"last_position_seconds"?: number,"last_viewed_at"?: string,"lesson_id": string,"member_id": string,"progress_pct"?: number,"status"?: string,"tenant_id": string,"time_spent_seconds"?: number,"view_count"?: number
                  }
                  Update: {
                    "completed_at"?: string | null,"course_id"?: string,"enrollment_id"?: string,"first_viewed_at"?: string,"last_position_seconds"?: number,"last_viewed_at"?: string,"lesson_id"?: string,"member_id"?: string,"progress_pct"?: number,"status"?: string,"tenant_id"?: string,"time_spent_seconds"?: number,"view_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "lesson_progress_tenant_id_enrollment_id_fkey"
      columns: ["tenant_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "lesson_progress_tenant_id_enrollment_id_fkey"
      columns: ["tenant_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "v_enrollment_overview"
      referencedColumns: ["tenant_id","enrollment_id"]
    },{
      foreignKeyName: "lesson_progress_tenant_id_lesson_id_fkey"
      columns: ["tenant_id","lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"lesson_resources": {
                  Row: {
                    "allow_download": boolean,"id": string,"lesson_id": string,"media_asset_id": string,"position": number,"tenant_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allow_download"?: boolean,"id"?: string,"lesson_id": string,"media_asset_id": string,"position"?: number,"tenant_id": string,"title": string
                  }
                  Update: {
                    "allow_download"?: boolean,"id"?: string,"lesson_id"?: string,"media_asset_id"?: string,"position"?: number,"tenant_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lesson_resources_tenant_id_lesson_id_fkey"
      columns: ["tenant_id","lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "lesson_resources_tenant_id_media_asset_id_fkey"
      columns: ["tenant_id","media_asset_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"lessons": {
                  Row: {
                    "assignment_id": string | null,"body": Json | null,"completion_rule": NonNullable<Json>,"course_id": string,"created_at": string,"deleted_at": string | null,"duration_seconds": number | null,"embed": Json | null,"external_url": string | null,"id": string,"is_mandatory": boolean,"is_preview": boolean,"is_published": boolean,"media_asset_id": string | null,"position": number,"published_at": string | null,"section_id": string,"settings": NonNullable<Json>,"summary": string | null,"tenant_id": string,"test_id": string | null,"title": string,"type": string,"unlock_rule": NonNullable<Json>,"updated_at": string,"xp_points": number
                  }
                  ComputedFields: never
                  Insert: {
                    "assignment_id"?: string | null,"body"?: Json | null,"completion_rule"?: NonNullable<Json>,"course_id": string,"created_at"?: string,"deleted_at"?: string | null,"duration_seconds"?: number | null,"embed"?: Json | null,"external_url"?: string | null,"id"?: string,"is_mandatory"?: boolean,"is_preview"?: boolean,"is_published"?: boolean,"media_asset_id"?: string | null,"position"?: number,"published_at"?: string | null,"section_id": string,"settings"?: NonNullable<Json>,"summary"?: string | null,"tenant_id": string,"test_id"?: string | null,"title": string,"type": string,"unlock_rule"?: NonNullable<Json>,"updated_at"?: string,"xp_points"?: number
                  }
                  Update: {
                    "assignment_id"?: string | null,"body"?: Json | null,"completion_rule"?: NonNullable<Json>,"course_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"duration_seconds"?: number | null,"embed"?: Json | null,"external_url"?: string | null,"id"?: string,"is_mandatory"?: boolean,"is_preview"?: boolean,"is_published"?: boolean,"media_asset_id"?: string | null,"position"?: number,"published_at"?: string | null,"section_id"?: string,"settings"?: NonNullable<Json>,"summary"?: string | null,"tenant_id"?: string,"test_id"?: string | null,"title"?: string,"type"?: string,"unlock_rule"?: NonNullable<Json>,"updated_at"?: string,"xp_points"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "lessons_assignment_fk"
      columns: ["tenant_id","assignment_id"]
isOneToOne: false
      referencedRelation: "assignments"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "lessons_course_id_section_id_fkey"
      columns: ["course_id","section_id"]
isOneToOne: false
      referencedRelation: "course_sections"
      referencedColumns: ["course_id","id"]
    },{
      foreignKeyName: "lessons_tenant_id_course_id_fkey"
      columns: ["tenant_id","course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "lessons_tenant_id_media_asset_id_fkey"
      columns: ["tenant_id","media_asset_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "lessons_test_fk"
      columns: ["tenant_id","test_id"]
isOneToOne: false
      referencedRelation: "tests"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"levels": {
                  Row: {
                    "icon_path": string | null,"id": string,"level_no": number,"min_xp": number,"name": string,"perks": NonNullable<Json>,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "icon_path"?: string | null,"id"?: string,"level_no": number,"min_xp": number,"name": string,"perks"?: NonNullable<Json>,"tenant_id": string
                  }
                  Update: {
                    "icon_path"?: string | null,"id"?: string,"level_no"?: number,"min_xp"?: number,"name"?: string,"perks"?: NonNullable<Json>,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "levels_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"live_session_hosts": {
                  Row: {
                    "host_key": string | null,"host_url": string | null,"provider_payload": NonNullable<Json>,"session_id": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "host_key"?: string | null,"host_url"?: string | null,"provider_payload"?: NonNullable<Json>,"session_id": string,"tenant_id": string
                  }
                  Update: {
                    "host_key"?: string | null,"host_url"?: string | null,"provider_payload"?: NonNullable<Json>,"session_id"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_session_hosts_tenant_id_session_id_fkey"
      columns: ["tenant_id","session_id"]
isOneToOne: false
      referencedRelation: "live_sessions"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"live_sessions": {
                  Row: {
                    "attendance_mode": string,"batch_id": string | null,"capacity": number | null,"course_id": string | null,"created_at": string,"description": string | null,"ends_at": string,"external_meeting_id": string | null,"host_member_id": string | null,"id": string,"join_url": string | null,"lesson_id": string | null,"location": Json | null,"provider": string,"recording_media_id": string | null,"series_id": string | null,"starts_at": string,"status": string,"tenant_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attendance_mode"?: string,"batch_id"?: string | null,"capacity"?: number | null,"course_id"?: string | null,"created_at"?: string,"description"?: string | null,"ends_at": string,"external_meeting_id"?: string | null,"host_member_id"?: string | null,"id"?: string,"join_url"?: string | null,"lesson_id"?: string | null,"location"?: Json | null,"provider"?: string,"recording_media_id"?: string | null,"series_id"?: string | null,"starts_at": string,"status"?: string,"tenant_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "attendance_mode"?: string,"batch_id"?: string | null,"capacity"?: number | null,"course_id"?: string | null,"created_at"?: string,"description"?: string | null,"ends_at"?: string,"external_meeting_id"?: string | null,"host_member_id"?: string | null,"id"?: string,"join_url"?: string | null,"lesson_id"?: string | null,"location"?: Json | null,"provider"?: string,"recording_media_id"?: string | null,"series_id"?: string | null,"starts_at"?: string,"status"?: string,"tenant_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_sessions_tenant_id_batch_id_fkey"
      columns: ["tenant_id","batch_id"]
isOneToOne: false
      referencedRelation: "batches"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "live_sessions_tenant_id_course_id_fkey"
      columns: ["tenant_id","course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "live_sessions_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_sessions_tenant_id_host_member_id_fkey"
      columns: ["tenant_id","host_member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "live_sessions_tenant_id_lesson_id_fkey"
      columns: ["tenant_id","lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "live_sessions_tenant_id_recording_media_id_fkey"
      columns: ["tenant_id","recording_media_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"media_assets": {
                  Row: {
                    "captions": NonNullable<Json>,"checksum_sha256": string | null,"created_at": string,"deleted_at": string | null,"drm_enabled": boolean,"duration_seconds": number | null,"external_id": string | null,"height": number | null,"id": string,"kind": string,"metadata": NonNullable<Json>,"mime_type": string | null,"page_count": number | null,"playback_id": string | null,"provider": string,"size_bytes": number | null,"status": string,"storage_bucket": string | null,"storage_path": string | null,"tenant_id": string,"title": string | null,"updated_at": string,"uploaded_by": string | null,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "captions"?: NonNullable<Json>,"checksum_sha256"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"drm_enabled"?: boolean,"duration_seconds"?: number | null,"external_id"?: string | null,"height"?: number | null,"id"?: string,"kind": string,"metadata"?: NonNullable<Json>,"mime_type"?: string | null,"page_count"?: number | null,"playback_id"?: string | null,"provider"?: string,"size_bytes"?: number | null,"status"?: string,"storage_bucket"?: string | null,"storage_path"?: string | null,"tenant_id": string,"title"?: string | null,"updated_at"?: string,"uploaded_by"?: string | null,"width"?: number | null
                  }
                  Update: {
                    "captions"?: NonNullable<Json>,"checksum_sha256"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"drm_enabled"?: boolean,"duration_seconds"?: number | null,"external_id"?: string | null,"height"?: number | null,"id"?: string,"kind"?: string,"metadata"?: NonNullable<Json>,"mime_type"?: string | null,"page_count"?: number | null,"playback_id"?: string | null,"provider"?: string,"size_bytes"?: number | null,"status"?: string,"storage_bucket"?: string | null,"storage_path"?: string | null,"tenant_id"?: string,"title"?: string | null,"updated_at"?: string,"uploaded_by"?: string | null,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "media_assets_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"member_badges": {
                  Row: {
                    "awarded_at": string,"awarded_by": string | null,"badge_id": string,"context": NonNullable<Json>,"member_id": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "awarded_at"?: string,"awarded_by"?: string | null,"badge_id": string,"context"?: NonNullable<Json>,"member_id": string,"tenant_id": string
                  }
                  Update: {
                    "awarded_at"?: string,"awarded_by"?: string | null,"badge_id"?: string,"context"?: NonNullable<Json>,"member_id"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_badges_tenant_id_badge_id_fkey"
      columns: ["tenant_id","badge_id"]
isOneToOne: false
      referencedRelation: "badges"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "member_badges_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"member_devices": {
                  Row: {
                    "auth_session_id": string | null,"device_fingerprint": string,"first_seen_at": string,"id": string,"ip": unknown,"label": string | null,"last_seen_at": string,"member_id": string,"revoked_at": string | null,"tenant_id": string,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "auth_session_id"?: string | null,"device_fingerprint": string,"first_seen_at"?: string,"id"?: string,"ip"?: unknown,"label"?: string | null,"last_seen_at"?: string,"member_id": string,"revoked_at"?: string | null,"tenant_id": string,"user_agent"?: string | null
                  }
                  Update: {
                    "auth_session_id"?: string | null,"device_fingerprint"?: string,"first_seen_at"?: string,"id"?: string,"ip"?: unknown,"label"?: string | null,"last_seen_at"?: string,"member_id"?: string,"revoked_at"?: string | null,"tenant_id"?: string,"user_agent"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_devices_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"member_roles": {
                  Row: {
                    "expires_at": string | null,"granted_at": string,"granted_by": string | null,"id": string,"member_id": string,"role_id": string,"scope_id": string | null,"scope_type": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "expires_at"?: string | null,"granted_at"?: string,"granted_by"?: string | null,"id"?: string,"member_id": string,"role_id": string,"scope_id"?: string | null,"scope_type"?: string,"tenant_id": string
                  }
                  Update: {
                    "expires_at"?: string | null,"granted_at"?: string,"granted_by"?: string | null,"id"?: string,"member_id"?: string,"role_id"?: string,"scope_id"?: string | null,"scope_type"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_roles_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "member_roles_tenant_id_role_id_fkey"
      columns: ["tenant_id","role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"member_stats": {
                  Row: {
                    "avg_test_pct": number | null,"badges_count": number,"current_streak": number,"last_active_day": string | null,"lessons_completed": number,"level_id": string | null,"longest_streak": number,"member_id": string,"tenant_id": string,"tests_taken": number,"updated_at": string,"xp_total": number
                  }
                  ComputedFields: never
                  Insert: {
                    "avg_test_pct"?: number | null,"badges_count"?: number,"current_streak"?: number,"last_active_day"?: string | null,"lessons_completed"?: number,"level_id"?: string | null,"longest_streak"?: number,"member_id": string,"tenant_id": string,"tests_taken"?: number,"updated_at"?: string,"xp_total"?: number
                  }
                  Update: {
                    "avg_test_pct"?: number | null,"badges_count"?: number,"current_streak"?: number,"last_active_day"?: string | null,"lessons_completed"?: number,"level_id"?: string | null,"longest_streak"?: number,"member_id"?: string,"tenant_id"?: string,"tests_taken"?: number,"updated_at"?: string,"xp_total"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_stats_tenant_id_level_id_fkey"
      columns: ["tenant_id","level_id"]
isOneToOne: false
      referencedRelation: "levels"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "member_stats_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"member_subscriptions": {
                  Row: {
                    "cancel_at_period_end": boolean,"cancelled_at": string | null,"created_at": string,"current_period_end": string | null,"current_period_start": string | null,"gateway": string | null,"gateway_subscription_id": string | null,"id": string,"member_id": string,"price_id": string | null,"product_id": string,"status": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_at_period_end"?: boolean,"cancelled_at"?: string | null,"created_at"?: string,"current_period_end"?: string | null,"current_period_start"?: string | null,"gateway"?: string | null,"gateway_subscription_id"?: string | null,"id"?: string,"member_id": string,"price_id"?: string | null,"product_id": string,"status": string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "cancel_at_period_end"?: boolean,"cancelled_at"?: string | null,"created_at"?: string,"current_period_end"?: string | null,"current_period_start"?: string | null,"gateway"?: string | null,"gateway_subscription_id"?: string | null,"id"?: string,"member_id"?: string,"price_id"?: string | null,"product_id"?: string,"status"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_subscriptions_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "member_subscriptions_tenant_id_price_id_fkey"
      columns: ["tenant_id","price_id"]
isOneToOne: false
      referencedRelation: "prices"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "member_subscriptions_tenant_id_product_id_fkey"
      columns: ["tenant_id","product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"message_deliveries": {
                  Row: {
                    "channel": string,"cost_minor": number | null,"created_at": string,"error": string | null,"event_key": string | null,"id": string,"member_id": string | null,"provider": string,"provider_message_id": string | null,"recipient": string,"status": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel": string,"cost_minor"?: number | null,"created_at"?: string,"error"?: string | null,"event_key"?: string | null,"id"?: string,"member_id"?: string | null,"provider": string,"provider_message_id"?: string | null,"recipient": string,"status"?: string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "channel"?: string,"cost_minor"?: number | null,"created_at"?: string,"error"?: string | null,"event_key"?: string | null,"id"?: string,"member_id"?: string | null,"provider"?: string,"provider_message_id"?: string | null,"recipient"?: string,"status"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "message_deliveries_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"access_whitelist": {
                  Row: {
                    "added_by": string,"batch_id": string | null,"claimed_at": string | null,"claimed_by": string | null,"course_id": string,"created_at": string,"email_norm": string,"enrollment_id": string | null,"expires_at": string | null,"full_name": string | null,"id": string,"note": string | null,"status": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by": string,"batch_id"?: string | null,"claimed_at"?: string | null,"claimed_by"?: string | null,"course_id": string,"created_at"?: string,"email_norm": string,"enrollment_id"?: string | null,"expires_at"?: string | null,"full_name"?: string | null,"id"?: string,"note"?: string | null,"status"?: string,"tenant_id": string
                  }
                  Update: {
                    "added_by"?: string,"batch_id"?: string | null,"claimed_at"?: string | null,"claimed_by"?: string | null,"course_id"?: string,"created_at"?: string,"email_norm"?: string,"enrollment_id"?: string | null,"expires_at"?: string | null,"full_name"?: string | null,"id"?: string,"note"?: string | null,"status"?: string,"tenant_id"?: string
                  }
                  Relationships: [
{
      foreignKeyName: "access_whitelist_tenant_id_course_id_fkey"
      columns: ["tenant_id","course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["tenant_id","id"]
    },
{
      foreignKeyName: "access_whitelist_tenant_id_batch_id_fkey"
      columns: ["tenant_id","batch_id"]
isOneToOne: false
      referencedRelation: "batches"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"payment_proofs": {
                  Row: {
                    "amount_minor": number,"file_path": string | null,"id": string,"member_id": string,"money_seen": boolean,"order_id": string,"payment_id": string,"reject_note": string | null,"reject_reason": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"source": string,"state": string,"submitted_at": string,"tenant_id": string,"utr": string | null,"whatsapp_seen": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"file_path"?: string | null,"id"?: string,"member_id": string,"money_seen"?: boolean,"order_id": string,"payment_id": string,"reject_note"?: string | null,"reject_reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"source"?: string,"state"?: string,"submitted_at"?: string,"tenant_id": string,"utr"?: string | null,"whatsapp_seen"?: boolean
                  }
                  Update: {
                    "amount_minor"?: number,"file_path"?: string | null,"id"?: string,"member_id"?: string,"money_seen"?: boolean,"order_id"?: string,"payment_id"?: string,"reject_note"?: string | null,"reject_reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"source"?: string,"state"?: string,"submitted_at"?: string,"tenant_id"?: string,"utr"?: string | null,"whatsapp_seen"?: boolean
                  }
                  Relationships: [
{
      foreignKeyName: "payment_proofs_tenant_id_order_id_fkey"
      columns: ["tenant_id","order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["tenant_id","id"]
    },
{
      foreignKeyName: "payment_proofs_tenant_id_payment_id_fkey"
      columns: ["tenant_id","payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["tenant_id","id"]
    },
{
      foreignKeyName: "payment_proofs_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"notification_preferences": {
                  Row: {
                    "channel": string,"enabled": boolean,"event_key": string,"member_id": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel": string,"enabled": boolean,"event_key": string,"member_id": string,"tenant_id": string
                  }
                  Update: {
                    "channel"?: string,"enabled"?: boolean,"event_key"?: string,"member_id"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_preferences_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"notification_templates": {
                  Row: {
                    "body": string,"channel": string,"created_at": string,"event_key": string,"id": string,"is_active": boolean,"locale": string,"provider_template_id": string | null,"subject": string | null,"tenant_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"channel": string,"created_at"?: string,"event_key": string,"id"?: string,"is_active"?: boolean,"locale"?: string,"provider_template_id"?: string | null,"subject"?: string | null,"tenant_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string,"channel"?: string,"created_at"?: string,"event_key"?: string,"id"?: string,"is_active"?: boolean,"locale"?: string,"provider_template_id"?: string | null,"subject"?: string | null,"tenant_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_templates_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "action_url": string | null,"body": string | null,"created_at": string,"data": NonNullable<Json>,"event_key": string,"id": string,"member_id": string,"read_at": string | null,"tenant_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action_url"?: string | null,"body"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"event_key": string,"id"?: string,"member_id": string,"read_at"?: string | null,"tenant_id": string,"title": string
                  }
                  Update: {
                    "action_url"?: string | null,"body"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"event_key"?: string,"id"?: string,"member_id"?: string,"read_at"?: string | null,"tenant_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "discount_minor": number,"fulfilled_at": string | null,"id": string,"order_id": string,"price_id": string | null,"product_id": string,"quantity": number,"tax_minor": number,"tax_snapshot": NonNullable<Json>,"tenant_id": string,"title_snapshot": string,"total_minor": number,"unit_amount_minor": number
                  }
                  ComputedFields: never
                  Insert: {
                    "discount_minor"?: number,"fulfilled_at"?: string | null,"id"?: string,"order_id": string,"price_id"?: string | null,"product_id": string,"quantity"?: number,"tax_minor"?: number,"tax_snapshot"?: NonNullable<Json>,"tenant_id": string,"title_snapshot": string,"total_minor": number,"unit_amount_minor": number
                  }
                  Update: {
                    "discount_minor"?: number,"fulfilled_at"?: string | null,"id"?: string,"order_id"?: string,"price_id"?: string | null,"product_id"?: string,"quantity"?: number,"tax_minor"?: number,"tax_snapshot"?: NonNullable<Json>,"tenant_id"?: string,"title_snapshot"?: string,"total_minor"?: number,"unit_amount_minor"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_tenant_id_order_id_fkey"
      columns: ["tenant_id","order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "order_items_tenant_id_price_id_fkey"
      columns: ["tenant_id","price_id"]
isOneToOne: false
      referencedRelation: "prices"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "order_items_tenant_id_product_id_fkey"
      columns: ["tenant_id","product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "affiliate_id": string | null,"amount_paid_minor": number,"billing_details": NonNullable<Json>,"cancelled_at": string | null,"coupon_id": string | null,"created_at": string,"created_by": string | null,"currency": string,"discount_minor": number,"id": string,"idempotency_key": string | null,"member_id": string,"notes": string | null,"order_no": string,"paid_at": string | null,"placed_at": string,"source": string,"status": string,"subtotal_minor": number,"tax_minor": number,"tenant_id": string,"total_minor": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "affiliate_id"?: string | null,"amount_paid_minor"?: number,"billing_details"?: NonNullable<Json>,"cancelled_at"?: string | null,"coupon_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"discount_minor"?: number,"id"?: string,"idempotency_key"?: string | null,"member_id": string,"notes"?: string | null,"order_no": string,"paid_at"?: string | null,"placed_at"?: string,"source"?: string,"status"?: string,"subtotal_minor"?: number,"tax_minor"?: number,"tenant_id": string,"total_minor"?: number,"updated_at"?: string
                  }
                  Update: {
                    "affiliate_id"?: string | null,"amount_paid_minor"?: number,"billing_details"?: NonNullable<Json>,"cancelled_at"?: string | null,"coupon_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"discount_minor"?: number,"id"?: string,"idempotency_key"?: string | null,"member_id"?: string,"notes"?: string | null,"order_no"?: string,"paid_at"?: string | null,"placed_at"?: string,"source"?: string,"status"?: string,"subtotal_minor"?: number,"tax_minor"?: number,"tenant_id"?: string,"total_minor"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_affiliate_fk"
      columns: ["tenant_id","affiliate_id"]
isOneToOne: false
      referencedRelation: "affiliates"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "orders_tenant_id_coupon_id_fkey"
      columns: ["tenant_id","coupon_id"]
isOneToOne: false
      referencedRelation: "coupons"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "orders_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"outbox_events": {
                  Row: {
                    "aggregate_id": string | null,"aggregate_type": string | null,"attempts": number,"available_at": string,"created_at": string,"event_type": string,"id": string,"last_error": string | null,"payload": NonNullable<Json>,"published_at": string | null,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aggregate_id"?: string | null,"aggregate_type"?: string | null,"attempts"?: number,"available_at"?: string,"created_at"?: string,"event_type": string,"id"?: string,"last_error"?: string | null,"payload"?: NonNullable<Json>,"published_at"?: string | null,"tenant_id": string
                  }
                  Update: {
                    "aggregate_id"?: string | null,"aggregate_type"?: string | null,"attempts"?: number,"available_at"?: string,"created_at"?: string,"event_type"?: string,"id"?: string,"last_error"?: string | null,"payload"?: NonNullable<Json>,"published_at"?: string | null,"tenant_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"payment_gateway_accounts": {
                  Row: {
                    "created_at": string,"gateway": string,"id": string,"is_active": boolean,"is_default": boolean,"mode": string,"public_key": string | null,"secret_vault_id": string | null,"tenant_id": string,"updated_at": string,"webhook_secret_vault_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"gateway": string,"id"?: string,"is_active"?: boolean,"is_default"?: boolean,"mode"?: string,"public_key"?: string | null,"secret_vault_id"?: string | null,"tenant_id": string,"updated_at"?: string,"webhook_secret_vault_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"gateway"?: string,"id"?: string,"is_active"?: boolean,"is_default"?: boolean,"mode"?: string,"public_key"?: string | null,"secret_vault_id"?: string | null,"tenant_id"?: string,"updated_at"?: string,"webhook_secret_vault_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_gateway_accounts_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_minor": number,"created_at": string,"currency": string,"failure_reason": string | null,"gateway": string,"gateway_order_id": string | null,"gateway_payment_id": string | null,"id": string,"installment_id": string | null,"method": string | null,"order_id": string,"paid_at": string | null,"raw": NonNullable<Json>,"receipt_no": string | null,"received_by": string | null,"status": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"created_at"?: string,"currency"?: string,"failure_reason"?: string | null,"gateway": string,"gateway_order_id"?: string | null,"gateway_payment_id"?: string | null,"id"?: string,"installment_id"?: string | null,"method"?: string | null,"order_id": string,"paid_at"?: string | null,"raw"?: NonNullable<Json>,"receipt_no"?: string | null,"received_by"?: string | null,"status": string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "amount_minor"?: number,"created_at"?: string,"currency"?: string,"failure_reason"?: string | null,"gateway"?: string,"gateway_order_id"?: string | null,"gateway_payment_id"?: string | null,"id"?: string,"installment_id"?: string | null,"method"?: string | null,"order_id"?: string,"paid_at"?: string | null,"raw"?: NonNullable<Json>,"receipt_no"?: string | null,"received_by"?: string | null,"status"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_tenant_id_installment_id_fkey"
      columns: ["tenant_id","installment_id"]
isOneToOne: false
      referencedRelation: "installments"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "payments_tenant_id_order_id_fkey"
      columns: ["tenant_id","order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"permission_catalog": {
                  Row: {
                    "description": string,"feature_key": string,"group_name": string,"is_sensitive": boolean,"key": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"feature_key": string,"group_name": string,"is_sensitive"?: boolean,"key": string
                  }
                  Update: {
                    "description"?: string,"feature_key"?: string,"group_name"?: string,"is_sensitive"?: boolean,"key"?: string
                  }
                  Relationships: [
                    
                  ]
                },"prices": {
                  Row: {
                    "amount_minor": number,"billing_interval": string | null,"billing_type": string,"compare_at_minor": number | null,"created_at": string,"currency": string,"id": string,"installment_plan": Json | null,"interval_count": number,"is_active": boolean,"is_default": boolean,"label": string,"product_id": string,"tax_rate_id": string | null,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"billing_interval"?: string | null,"billing_type"?: string,"compare_at_minor"?: number | null,"created_at"?: string,"currency"?: string,"id"?: string,"installment_plan"?: Json | null,"interval_count"?: number,"is_active"?: boolean,"is_default"?: boolean,"label"?: string,"product_id": string,"tax_rate_id"?: string | null,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "amount_minor"?: number,"billing_interval"?: string | null,"billing_type"?: string,"compare_at_minor"?: number | null,"created_at"?: string,"currency"?: string,"id"?: string,"installment_plan"?: Json | null,"interval_count"?: number,"is_active"?: boolean,"is_default"?: boolean,"label"?: string,"product_id"?: string,"tax_rate_id"?: string | null,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "prices_tenant_id_product_id_fkey"
      columns: ["tenant_id","product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "prices_tenant_id_tax_rate_id_fkey"
      columns: ["tenant_id","tax_rate_id"]
isOneToOne: false
      referencedRelation: "tax_rates"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"product_items": {
                  Row: {
                    "batch_id": string | null,"child_product_id": string | null,"course_id": string | null,"id": string,"position": number,"product_id": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_id"?: string | null,"child_product_id"?: string | null,"course_id"?: string | null,"id"?: string,"position"?: number,"product_id": string,"tenant_id": string
                  }
                  Update: {
                    "batch_id"?: string | null,"child_product_id"?: string | null,"course_id"?: string | null,"id"?: string,"position"?: number,"product_id"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_items_tenant_id_batch_id_fkey"
      columns: ["tenant_id","batch_id"]
isOneToOne: false
      referencedRelation: "batches"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "product_items_tenant_id_child_product_id_fkey"
      columns: ["tenant_id","child_product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "product_items_tenant_id_course_id_fkey"
      columns: ["tenant_id","course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "product_items_tenant_id_product_id_fkey"
      columns: ["tenant_id","product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"products": {
                  Row: {
                    "access_duration_days": number | null,"cover_path": string | null,"created_at": string,"custom_fields": NonNullable<Json>,"deleted_at": string | null,"description": Json | null,"id": string,"kind": string,"max_sales": number | null,"sale_ends_at": string | null,"sale_starts_at": string | null,"sales_count": number,"seo": NonNullable<Json>,"slug": string,"sort_order": number,"status": string,"subtitle": string | null,"tenant_id": string,"title": string,"updated_at": string,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "access_duration_days"?: number | null,"cover_path"?: string | null,"created_at"?: string,"custom_fields"?: NonNullable<Json>,"deleted_at"?: string | null,"description"?: Json | null,"id"?: string,"kind": string,"max_sales"?: number | null,"sale_ends_at"?: string | null,"sale_starts_at"?: string | null,"sales_count"?: number,"seo"?: NonNullable<Json>,"slug": string,"sort_order"?: number,"status"?: string,"subtitle"?: string | null,"tenant_id": string,"title": string,"updated_at"?: string,"visibility"?: string
                  }
                  Update: {
                    "access_duration_days"?: number | null,"cover_path"?: string | null,"created_at"?: string,"custom_fields"?: NonNullable<Json>,"deleted_at"?: string | null,"description"?: Json | null,"id"?: string,"kind"?: string,"max_sales"?: number | null,"sale_ends_at"?: string | null,"sale_starts_at"?: string | null,"sales_count"?: number,"seo"?: NonNullable<Json>,"slug"?: string,"sort_order"?: number,"status"?: string,"subtitle"?: string | null,"tenant_id"?: string,"title"?: string,"updated_at"?: string,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "created_at": string,"id": string,"last_used_at": string | null,"member_id": string,"platform": string,"tenant_id": string,"token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"last_used_at"?: string | null,"member_id": string,"platform": string,"tenant_id": string,"token": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"last_used_at"?: string | null,"member_id"?: string,"platform"?: string,"tenant_id"?: string,"token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"question_keys": {
                  Row: {
                    "answer": NonNullable<Json>,"grading": NonNullable<Json>,"question_id": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer": NonNullable<Json>,"grading"?: NonNullable<Json>,"question_id": string,"tenant_id": string
                  }
                  Update: {
                    "answer"?: NonNullable<Json>,"grading"?: NonNullable<Json>,"question_id"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_keys_tenant_id_question_id_fkey"
      columns: ["tenant_id","question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"question_stats": {
                  Row: {
                    "attempts_count": number,"avg_time_seconds": number | null,"correct_count": number,"discrimination_index": number | null,"question_id": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts_count"?: number,"avg_time_seconds"?: number | null,"correct_count"?: number,"discrimination_index"?: number | null,"question_id": string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "attempts_count"?: number,"avg_time_seconds"?: number | null,"correct_count"?: number,"discrimination_index"?: number | null,"question_id"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_stats_tenant_id_question_id_fkey"
      columns: ["tenant_id","question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"questions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"default_marks": number,"default_negative_marks": number,"deleted_at": string | null,"difficulty": number | null,"exam_year": number | null,"explanation": Json | null,"hints": Json | null,"id": string,"language": string,"options": NonNullable<Json>,"passage_id": string | null,"reviewed_by": string | null,"source": string | null,"status": string,"stem": NonNullable<Json>,"subject_term_id": string | null,"tags": (string)[],"tenant_id": string,"topic_term_id": string | null,"translations": NonNullable<Json>,"type": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"default_marks"?: number,"default_negative_marks"?: number,"deleted_at"?: string | null,"difficulty"?: number | null,"exam_year"?: number | null,"explanation"?: Json | null,"hints"?: Json | null,"id"?: string,"language"?: string,"options"?: NonNullable<Json>,"passage_id"?: string | null,"reviewed_by"?: string | null,"source"?: string | null,"status"?: string,"stem": NonNullable<Json>,"subject_term_id"?: string | null,"tags"?: (string)[],"tenant_id": string,"topic_term_id"?: string | null,"translations"?: NonNullable<Json>,"type": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"default_marks"?: number,"default_negative_marks"?: number,"deleted_at"?: string | null,"difficulty"?: number | null,"exam_year"?: number | null,"explanation"?: Json | null,"hints"?: Json | null,"id"?: string,"language"?: string,"options"?: NonNullable<Json>,"passage_id"?: string | null,"reviewed_by"?: string | null,"source"?: string | null,"status"?: string,"stem"?: NonNullable<Json>,"subject_term_id"?: string | null,"tags"?: (string)[],"tenant_id"?: string,"topic_term_id"?: string | null,"translations"?: NonNullable<Json>,"type"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "questions_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "questions_tenant_id_passage_id_fkey"
      columns: ["tenant_id","passage_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "questions_tenant_id_subject_term_id_fkey"
      columns: ["tenant_id","subject_term_id"]
isOneToOne: false
      referencedRelation: "taxonomy_terms"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "questions_tenant_id_topic_term_id_fkey"
      columns: ["tenant_id","topic_term_id"]
isOneToOne: false
      referencedRelation: "taxonomy_terms"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"refunds": {
                  Row: {
                    "amount_minor": number,"created_at": string,"gateway_refund_id": string | null,"id": string,"initiated_by": string | null,"payment_id": string,"processed_at": string | null,"reason": string | null,"revoke_access": boolean,"status": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"created_at"?: string,"gateway_refund_id"?: string | null,"id"?: string,"initiated_by"?: string | null,"payment_id": string,"processed_at"?: string | null,"reason"?: string | null,"revoke_access"?: boolean,"status"?: string,"tenant_id": string
                  }
                  Update: {
                    "amount_minor"?: number,"created_at"?: string,"gateway_refund_id"?: string | null,"id"?: string,"initiated_by"?: string | null,"payment_id"?: string,"processed_at"?: string | null,"reason"?: string | null,"revoke_access"?: boolean,"status"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "refunds_tenant_id_payment_id_fkey"
      columns: ["tenant_id","payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"reviews": {
                  Row: {
                    "body": string | null,"course_id": string,"created_at": string,"id": string,"member_id": string,"rating": number,"reply": Json | null,"status": string,"tenant_id": string,"title": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"course_id": string,"created_at"?: string,"id"?: string,"member_id": string,"rating": number,"reply"?: Json | null,"status"?: string,"tenant_id": string,"title"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string | null,"course_id"?: string,"created_at"?: string,"id"?: string,"member_id"?: string,"rating"?: number,"reply"?: Json | null,"status"?: string,"tenant_id"?: string,"title"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_tenant_id_course_id_fkey"
      columns: ["tenant_id","course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "reviews_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"role_permissions": {
                  Row: {
                    "permission_key": string,"role_id": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "permission_key": string,"role_id": string,"tenant_id": string
                  }
                  Update: {
                    "permission_key"?: string,"role_id"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "role_permissions_permission_key_fkey"
      columns: ["permission_key"]
isOneToOne: false
      referencedRelation: "permission_catalog"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "role_permissions_tenant_id_role_id_fkey"
      columns: ["tenant_id","role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"roles": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"is_system": boolean,"key": string,"kind": string,"name": string,"sort_order": number,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_system"?: boolean,"key": string,"kind"?: string,"name": string,"sort_order"?: number,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_system"?: boolean,"key"?: string,"kind"?: string,"name"?: string,"sort_order"?: number,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "roles_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"showcase_items": {
                  Row: {
                    "body": string | null,"created_at": string,"exam": string | null,"headline": string | null,"id": string,"is_featured": boolean,"is_published": boolean,"kind": string,"member_id": string | null,"name": string,"photo_path": string | null,"position": number,"tenant_id": string,"updated_at": string,"video_url": string | null,"year": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"exam"?: string | null,"headline"?: string | null,"id"?: string,"is_featured"?: boolean,"is_published"?: boolean,"kind": string,"member_id"?: string | null,"name": string,"photo_path"?: string | null,"position"?: number,"tenant_id": string,"updated_at"?: string,"video_url"?: string | null,"year"?: number | null
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"exam"?: string | null,"headline"?: string | null,"id"?: string,"is_featured"?: boolean,"is_published"?: boolean,"kind"?: string,"member_id"?: string | null,"name"?: string,"photo_path"?: string | null,"position"?: number,"tenant_id"?: string,"updated_at"?: string,"video_url"?: string | null,"year"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "showcase_items_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"site_navigation": {
                  Row: {
                    "items": NonNullable<Json>,"location": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "items"?: NonNullable<Json>,"location": string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "items"?: NonNullable<Json>,"location"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "site_navigation_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"site_page_versions": {
                  Row: {
                    "blocks": NonNullable<Json>,"created_at": string,"created_by": string | null,"id": string,"page_id": string,"seo": NonNullable<Json>,"tenant_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "blocks": NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"id"?: string,"page_id": string,"seo"?: NonNullable<Json>,"tenant_id": string,"version": number
                  }
                  Update: {
                    "blocks"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"id"?: string,"page_id"?: string,"seo"?: NonNullable<Json>,"tenant_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "site_page_versions_tenant_id_page_id_fkey"
      columns: ["tenant_id","page_id"]
isOneToOne: false
      referencedRelation: "site_pages"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"site_pages": {
                  Row: {
                    "blocks": NonNullable<Json>,"created_at": string,"id": string,"is_system": boolean,"path": string,"published_at": string | null,"published_blocks": Json | null,"seo": NonNullable<Json>,"status": string,"template_key": string,"tenant_id": string,"title": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "blocks"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"is_system"?: boolean,"path": string,"published_at"?: string | null,"published_blocks"?: Json | null,"seo"?: NonNullable<Json>,"status"?: string,"template_key"?: string,"tenant_id": string,"title": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "blocks"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"is_system"?: boolean,"path"?: string,"published_at"?: string | null,"published_blocks"?: Json | null,"seo"?: NonNullable<Json>,"status"?: string,"template_key"?: string,"tenant_id"?: string,"title"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "site_pages_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"syllabus_coverage": {
                  Row: {
                    "coverage_pct": number,"covered_by": string | null,"covered_on": string,"created_at": string,"id": string,"item_id": string,"live_session_id": string | null,"notes": string | null,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "coverage_pct": number,"covered_by"?: string | null,"covered_on"?: string,"created_at"?: string,"id"?: string,"item_id": string,"live_session_id"?: string | null,"notes"?: string | null,"tenant_id": string
                  }
                  Update: {
                    "coverage_pct"?: number,"covered_by"?: string | null,"covered_on"?: string,"created_at"?: string,"id"?: string,"item_id"?: string,"live_session_id"?: string | null,"notes"?: string | null,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "syllabus_coverage_tenant_id_item_id_fkey"
      columns: ["tenant_id","item_id"]
isOneToOne: false
      referencedRelation: "syllabus_items"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "syllabus_coverage_tenant_id_item_id_fkey"
      columns: ["tenant_id","item_id"]
isOneToOne: false
      referencedRelation: "v_syllabus_item_status"
      referencedColumns: ["tenant_id","item_id"]
    },{
      foreignKeyName: "syllabus_coverage_tenant_id_live_session_id_fkey"
      columns: ["tenant_id","live_session_id"]
isOneToOne: false
      referencedRelation: "live_sessions"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"syllabus_items": {
                  Row: {
                    "created_at": string,"id": string,"lesson_id": string | null,"owner_member_id": string | null,"phase_label": string | null,"plan_id": string,"planned_end": string | null,"planned_start": string | null,"position": number,"section_id": string | null,"tenant_id": string,"title": string,"updated_at": string,"weight": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"lesson_id"?: string | null,"owner_member_id"?: string | null,"phase_label"?: string | null,"plan_id": string,"planned_end"?: string | null,"planned_start"?: string | null,"position"?: number,"section_id"?: string | null,"tenant_id": string,"title": string,"updated_at"?: string,"weight"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"lesson_id"?: string | null,"owner_member_id"?: string | null,"phase_label"?: string | null,"plan_id"?: string,"planned_end"?: string | null,"planned_start"?: string | null,"position"?: number,"section_id"?: string | null,"tenant_id"?: string,"title"?: string,"updated_at"?: string,"weight"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "syllabus_items_tenant_id_lesson_id_fkey"
      columns: ["tenant_id","lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "syllabus_items_tenant_id_owner_member_id_fkey"
      columns: ["tenant_id","owner_member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "syllabus_items_tenant_id_plan_id_fkey"
      columns: ["tenant_id","plan_id"]
isOneToOne: false
      referencedRelation: "syllabus_plans"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "syllabus_items_tenant_id_section_id_fkey"
      columns: ["tenant_id","section_id"]
isOneToOne: false
      referencedRelation: "course_sections"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"syllabus_plans": {
                  Row: {
                    "batch_id": string,"course_id": string,"created_at": string,"created_by": string | null,"id": string,"status": string,"tenant_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_id": string,"course_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"status"?: string,"tenant_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "batch_id"?: string,"course_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"status"?: string,"tenant_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "syllabus_plans_tenant_id_batch_id_fkey"
      columns: ["tenant_id","batch_id"]
isOneToOne: false
      referencedRelation: "batches"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "syllabus_plans_tenant_id_course_id_fkey"
      columns: ["tenant_id","course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"tax_rates": {
                  Row: {
                    "hsn_sac_code": string | null,"id": string,"is_active": boolean,"is_inclusive": boolean,"name": string,"rate_pct": number,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "hsn_sac_code"?: string | null,"id"?: string,"is_active"?: boolean,"is_inclusive"?: boolean,"name": string,"rate_pct": number,"tenant_id": string
                  }
                  Update: {
                    "hsn_sac_code"?: string | null,"id"?: string,"is_active"?: boolean,"is_inclusive"?: boolean,"name"?: string,"rate_pct"?: number,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tax_rates_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"taxonomy_terms": {
                  Row: {
                    "created_at": string,"description": string | null,"icon_path": string | null,"id": string,"name": string,"parent_id": string | null,"slug": string,"sort_order": number,"tenant_id": string,"updated_at": string,"vocabulary": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"icon_path"?: string | null,"id"?: string,"name": string,"parent_id"?: string | null,"slug": string,"sort_order"?: number,"tenant_id": string,"updated_at"?: string,"vocabulary": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"icon_path"?: string | null,"id"?: string,"name"?: string,"parent_id"?: string | null,"slug"?: string,"sort_order"?: number,"tenant_id"?: string,"updated_at"?: string,"vocabulary"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "taxonomy_terms_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "taxonomy_terms_tenant_id_parent_id_fkey"
      columns: ["tenant_id","parent_id"]
isOneToOne: false
      referencedRelation: "taxonomy_terms"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"tenant_branding": {
                  Row: {
                    "analytics": NonNullable<Json>,"contact": NonNullable<Json>,"display_name": string,"favicon_path": string | null,"footer": NonNullable<Json>,"icon_path": string | null,"logo_dark_path": string | null,"logo_path": string | null,"og_image_path": string | null,"seo": NonNullable<Json>,"show_powered_by": boolean,"social": NonNullable<Json>,"tagline": string | null,"tenant_id": string,"theme_key": string,"theme_settings": NonNullable<Json>,"tokens": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "analytics"?: NonNullable<Json>,"contact"?: NonNullable<Json>,"display_name": string,"favicon_path"?: string | null,"footer"?: NonNullable<Json>,"icon_path"?: string | null,"logo_dark_path"?: string | null,"logo_path"?: string | null,"og_image_path"?: string | null,"seo"?: NonNullable<Json>,"show_powered_by"?: boolean,"social"?: NonNullable<Json>,"tagline"?: string | null,"tenant_id": string,"theme_key"?: string,"theme_settings"?: NonNullable<Json>,"tokens"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "analytics"?: NonNullable<Json>,"contact"?: NonNullable<Json>,"display_name"?: string,"favicon_path"?: string | null,"footer"?: NonNullable<Json>,"icon_path"?: string | null,"logo_dark_path"?: string | null,"logo_path"?: string | null,"og_image_path"?: string | null,"seo"?: NonNullable<Json>,"show_powered_by"?: boolean,"social"?: NonNullable<Json>,"tagline"?: string | null,"tenant_id"?: string,"theme_key"?: string,"theme_settings"?: NonNullable<Json>,"tokens"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_branding_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: true
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_counters": {
                  Row: {
                    "counter_key": string,"tenant_id": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "counter_key": string,"tenant_id": string,"value"?: number
                  }
                  Update: {
                    "counter_key"?: string,"tenant_id"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_counters_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_entitlements": {
                  Row: {
                    "config": NonNullable<Json>,"enabled": boolean,"feature_key": string,"limit_value": number | null,"synced_at": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "config"?: NonNullable<Json>,"enabled": boolean,"feature_key": string,"limit_value"?: number | null,"synced_at"?: string,"tenant_id": string
                  }
                  Update: {
                    "config"?: NonNullable<Json>,"enabled"?: boolean,"feature_key"?: string,"limit_value"?: number | null,"synced_at"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_entitlements_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_members": {
                  Row: {
                    "avatar_path": string | null,"branch_id": string | null,"created_at": string,"custom_fields": NonNullable<Json>,"date_of_birth": string | null,"display_name": string,"email": string | null,"email_verified_at": string | null,"gender": string | null,"id": string,"is_minor": boolean,"joined_at": string,"last_active_at": string | null,"locale": string | null,"member_code": string | null,"phone": string | null,"status": string,"tenant_id": string,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"branch_id"?: string | null,"created_at"?: string,"custom_fields"?: NonNullable<Json>,"date_of_birth"?: string | null,"display_name": string,"email"?: string | null,"email_verified_at"?: string | null,"gender"?: string | null,"id"?: string,"is_minor"?: boolean,"joined_at"?: string,"last_active_at"?: string | null,"locale"?: string | null,"member_code"?: string | null,"phone"?: string | null,"status"?: string,"tenant_id": string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "avatar_path"?: string | null,"branch_id"?: string | null,"created_at"?: string,"custom_fields"?: NonNullable<Json>,"date_of_birth"?: string | null,"display_name"?: string,"email"?: string | null,"email_verified_at"?: string | null,"gender"?: string | null,"id"?: string,"is_minor"?: boolean,"joined_at"?: string,"last_active_at"?: string | null,"locale"?: string | null,"member_code"?: string | null,"phone"?: string | null,"status"?: string,"tenant_id"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_members_tenant_id_branch_id_fkey"
      columns: ["tenant_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "tenant_members_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_modules": {
                  Row: {
                    "config": NonNullable<Json>,"feature_key": string,"is_enabled": boolean,"tenant_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "config"?: NonNullable<Json>,"feature_key": string,"is_enabled"?: boolean,"tenant_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "config"?: NonNullable<Json>,"feature_key"?: string,"is_enabled"?: boolean,"tenant_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_modules_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_settings": {
                  Row: {
                    "assessment": NonNullable<Json>,"auth": NonNullable<Json>,"commerce": NonNullable<Json>,"learning": NonNullable<Json>,"localization": NonNullable<Json>,"notifications": NonNullable<Json>,"security": NonNullable<Json>,"tenant_id": string,"terminology": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assessment"?: NonNullable<Json>,"auth"?: NonNullable<Json>,"commerce"?: NonNullable<Json>,"learning"?: NonNullable<Json>,"localization"?: NonNullable<Json>,"notifications"?: NonNullable<Json>,"security"?: NonNullable<Json>,"tenant_id": string,"terminology"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "assessment"?: NonNullable<Json>,"auth"?: NonNullable<Json>,"commerce"?: NonNullable<Json>,"learning"?: NonNullable<Json>,"localization"?: NonNullable<Json>,"notifications"?: NonNullable<Json>,"security"?: NonNullable<Json>,"tenant_id"?: string,"terminology"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_settings_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: true
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenants": {
                  Row: {
                    "country": string,"created_at": string,"currency": string,"default_locale": string,"frontend_template_key": string,"id": string,"name": string,"slug": string,"status": string,"synced_at": string,"timezone": string,"updated_at": string,"vertical_key": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "country"?: string,"created_at"?: string,"currency"?: string,"default_locale"?: string,"frontend_template_key"?: string,"id": string,"name": string,"slug": string,"status": string,"synced_at"?: string,"timezone"?: string,"updated_at"?: string,"vertical_key"?: string | null
                  }
                  Update: {
                    "country"?: string,"created_at"?: string,"currency"?: string,"default_locale"?: string,"frontend_template_key"?: string,"id"?: string,"name"?: string,"slug"?: string,"status"?: string,"synced_at"?: string,"timezone"?: string,"updated_at"?: string,"vertical_key"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"test_attempts": {
                  Row: {
                    "attempt_no": number,"client_meta": NonNullable<Json>,"correct_count": number | null,"created_at": string,"deadline_at": string | null,"enrollment_id": string | null,"graded_at": string | null,"graded_by": string | null,"id": string,"incorrect_count": number | null,"is_passed": boolean | null,"max_score": number | null,"member_id": string,"paper": NonNullable<Json>,"pending_manual": number,"percentage": number | null,"percentile": number | null,"proctor_flags": NonNullable<Json>,"rank": number | null,"score": number | null,"started_at": string,"status": string,"submitted_at": string | null,"tenant_id": string,"test_id": string,"time_taken_seconds": number | null,"unattempted_count": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt_no": number,"client_meta"?: NonNullable<Json>,"correct_count"?: number | null,"created_at"?: string,"deadline_at"?: string | null,"enrollment_id"?: string | null,"graded_at"?: string | null,"graded_by"?: string | null,"id"?: string,"incorrect_count"?: number | null,"is_passed"?: boolean | null,"max_score"?: number | null,"member_id": string,"paper": NonNullable<Json>,"pending_manual"?: number,"percentage"?: number | null,"percentile"?: number | null,"proctor_flags"?: NonNullable<Json>,"rank"?: number | null,"score"?: number | null,"started_at"?: string,"status"?: string,"submitted_at"?: string | null,"tenant_id": string,"test_id": string,"time_taken_seconds"?: number | null,"unattempted_count"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "attempt_no"?: number,"client_meta"?: NonNullable<Json>,"correct_count"?: number | null,"created_at"?: string,"deadline_at"?: string | null,"enrollment_id"?: string | null,"graded_at"?: string | null,"graded_by"?: string | null,"id"?: string,"incorrect_count"?: number | null,"is_passed"?: boolean | null,"max_score"?: number | null,"member_id"?: string,"paper"?: NonNullable<Json>,"pending_manual"?: number,"percentage"?: number | null,"percentile"?: number | null,"proctor_flags"?: NonNullable<Json>,"rank"?: number | null,"score"?: number | null,"started_at"?: string,"status"?: string,"submitted_at"?: string | null,"tenant_id"?: string,"test_id"?: string,"time_taken_seconds"?: number | null,"unattempted_count"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "test_attempts_tenant_id_enrollment_id_fkey"
      columns: ["tenant_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "test_attempts_tenant_id_enrollment_id_fkey"
      columns: ["tenant_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "v_enrollment_overview"
      referencedColumns: ["tenant_id","enrollment_id"]
    },{
      foreignKeyName: "test_attempts_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "test_attempts_tenant_id_test_id_fkey"
      columns: ["tenant_id","test_id"]
isOneToOne: false
      referencedRelation: "tests"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"test_questions": {
                  Row: {
                    "marks": number | null,"negative_marks": number | null,"position": number,"question_id": string,"section_id": string | null,"tenant_id": string,"test_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "marks"?: number | null,"negative_marks"?: number | null,"position"?: number,"question_id": string,"section_id"?: string | null,"tenant_id": string,"test_id": string
                  }
                  Update: {
                    "marks"?: number | null,"negative_marks"?: number | null,"position"?: number,"question_id"?: string,"section_id"?: string | null,"tenant_id"?: string,"test_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "test_questions_tenant_id_question_id_fkey"
      columns: ["tenant_id","question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "test_questions_tenant_id_test_id_fkey"
      columns: ["tenant_id","test_id"]
isOneToOne: false
      referencedRelation: "tests"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "test_questions_test_id_section_id_fkey"
      columns: ["test_id","section_id"]
isOneToOne: false
      referencedRelation: "test_sections"
      referencedColumns: ["test_id","id"]
    }
                  ]
                },"test_sections": {
                  Row: {
                    "duration_seconds": number | null,"id": string,"instructions": Json | null,"marks_per_question": number | null,"negative_marks": number | null,"position": number,"question_selection": NonNullable<Json>,"tenant_id": string,"test_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "duration_seconds"?: number | null,"id"?: string,"instructions"?: Json | null,"marks_per_question"?: number | null,"negative_marks"?: number | null,"position"?: number,"question_selection"?: NonNullable<Json>,"tenant_id": string,"test_id": string,"title": string
                  }
                  Update: {
                    "duration_seconds"?: number | null,"id"?: string,"instructions"?: Json | null,"marks_per_question"?: number | null,"negative_marks"?: number | null,"position"?: number,"question_selection"?: NonNullable<Json>,"tenant_id"?: string,"test_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "test_sections_tenant_id_test_id_fkey"
      columns: ["tenant_id","test_id"]
isOneToOne: false
      referencedRelation: "tests"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"tests": {
                  Row: {
                    "answer_visibility": string,"available_from": string | null,"available_until": string | null,"course_id": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"description": string | null,"duration_seconds": number | null,"grace_seconds": number,"id": string,"instructions": Json | null,"kind": string,"max_attempts": number | null,"negative_marking": boolean,"pass_marks": number | null,"result_visibility": string,"results_published_at": string | null,"settings": NonNullable<Json>,"shuffle_options": boolean,"shuffle_questions": boolean,"slug": string | null,"status": string,"tenant_id": string,"title": string,"total_marks": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer_visibility"?: string,"available_from"?: string | null,"available_until"?: string | null,"course_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"description"?: string | null,"duration_seconds"?: number | null,"grace_seconds"?: number,"id"?: string,"instructions"?: Json | null,"kind"?: string,"max_attempts"?: number | null,"negative_marking"?: boolean,"pass_marks"?: number | null,"result_visibility"?: string,"results_published_at"?: string | null,"settings"?: NonNullable<Json>,"shuffle_options"?: boolean,"shuffle_questions"?: boolean,"slug"?: string | null,"status"?: string,"tenant_id": string,"title": string,"total_marks"?: number,"updated_at"?: string
                  }
                  Update: {
                    "answer_visibility"?: string,"available_from"?: string | null,"available_until"?: string | null,"course_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"description"?: string | null,"duration_seconds"?: number | null,"grace_seconds"?: number,"id"?: string,"instructions"?: Json | null,"kind"?: string,"max_attempts"?: number | null,"negative_marking"?: boolean,"pass_marks"?: number | null,"result_visibility"?: string,"results_published_at"?: string | null,"settings"?: NonNullable<Json>,"shuffle_options"?: boolean,"shuffle_questions"?: boolean,"slug"?: string | null,"status"?: string,"tenant_id"?: string,"title"?: string,"total_marks"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tests_tenant_id_course_id_fkey"
      columns: ["tenant_id","course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "tests_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"votes": {
                  Row: {
                    "created_at": string,"member_id": string,"target_id": string,"target_type": string,"tenant_id": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"member_id": string,"target_id": string,"target_type": string,"tenant_id": string,"value": number
                  }
                  Update: {
                    "created_at"?: string,"member_id"?: string,"target_id"?: string,"target_type"?: string,"tenant_id"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "votes_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"webhook_deliveries": {
                  Row: {
                    "attempts": number,"created_at": string,"endpoint_id": string,"event_id": string,"id": string,"next_retry_at": string | null,"response_code": number | null,"status": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"endpoint_id": string,"event_id": string,"id"?: string,"next_retry_at"?: string | null,"response_code"?: number | null,"status"?: string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"endpoint_id"?: string,"event_id"?: string,"id"?: string,"next_retry_at"?: string | null,"response_code"?: number | null,"status"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "webhook_deliveries_tenant_id_endpoint_id_fkey"
      columns: ["tenant_id","endpoint_id"]
isOneToOne: false
      referencedRelation: "webhook_endpoints"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"webhook_endpoints": {
                  Row: {
                    "created_at": string,"description": string | null,"events": (string)[],"failure_count": number,"id": string,"is_active": boolean,"secret_vault_id": string | null,"tenant_id": string,"updated_at": string,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"events"?: (string)[],"failure_count"?: number,"id"?: string,"is_active"?: boolean,"secret_vault_id"?: string | null,"tenant_id": string,"updated_at"?: string,"url": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"events"?: (string)[],"failure_count"?: number,"id"?: string,"is_active"?: boolean,"secret_vault_id"?: string | null,"tenant_id"?: string,"updated_at"?: string,"url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "webhook_endpoints_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"xp_ledger": {
                  Row: {
                    "awarded_by": string | null,"id": string,"idempotency_key": string,"member_id": string,"occurred_at": string,"points": number,"reason": string,"source_id": string | null,"source_type": string | null,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "awarded_by"?: string | null,"id"?: string,"idempotency_key": string,"member_id": string,"occurred_at"?: string,"points": number,"reason": string,"source_id"?: string | null,"source_type"?: string | null,"tenant_id": string
                  }
                  Update: {
                    "awarded_by"?: string | null,"id"?: string,"idempotency_key"?: string,"member_id"?: string,"occurred_at"?: string,"points"?: number,"reason"?: string,"source_id"?: string | null,"source_type"?: string | null,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "xp_ledger_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                }
          }
          Views: {
            "v_enrollment_overview": {
                  Row: {
                    "active_days": number | null,"batch_id": string | null,"completed_at": string | null,"course_id": string,"days_enrolled": number | null,"days_remaining": number | null,"days_since_active": number | null,"enrollment_id": string,"expires_at": string | null,"last_activity_at": string | null,"lessons_completed": number,"lessons_total": number,"member_id": string,"progress_pct": number,"started_at": string,"status": string,"tenant_id": string,"total_time_seconds": number
                  }
                  ComputedFields: never
                  Insert: {
                           "active_days"?: never,"batch_id"?: string | null,"completed_at"?: string | null,"course_id"?: string | null,"days_enrolled"?: never,"days_remaining"?: never,"days_since_active"?: never,"enrollment_id"?: string | null,"expires_at"?: string | null,"last_activity_at"?: string | null,"lessons_completed"?: number | null,"lessons_total"?: number | null,"member_id"?: string | null,"progress_pct"?: number | null,"started_at"?: string | null,"status"?: string | null,"tenant_id"?: string | null,"total_time_seconds"?: number | null
                         }
                        Update: {
                           "active_days"?: never,"batch_id"?: string | null,"completed_at"?: string | null,"course_id"?: string | null,"days_enrolled"?: never,"days_remaining"?: never,"days_since_active"?: never,"enrollment_id"?: string | null,"expires_at"?: string | null,"last_activity_at"?: string | null,"lessons_completed"?: number | null,"lessons_total"?: number | null,"member_id"?: string | null,"progress_pct"?: number | null,"started_at"?: string | null,"status"?: string | null,"tenant_id"?: string | null,"total_time_seconds"?: number | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "enrollments_tenant_id_batch_id_fkey"
      columns: ["tenant_id","batch_id"]
isOneToOne: false
      referencedRelation: "batches"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "enrollments_tenant_id_course_id_fkey"
      columns: ["tenant_id","course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "enrollments_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"v_instructor_syllabus_progress": {
                  Row: {
                    "actual_pct": number | null,"batch_id": string,"course_id": string,"expected_pct": number | null,"items_completed": number | null,"items_delayed": number | null,"items_total": number | null,"owner_member_id": string | null,"schedule_variance_pct": number | null,"tenant_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "syllabus_items_tenant_id_owner_member_id_fkey"
      columns: ["tenant_id","owner_member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"v_syllabus_item_status": {
                  Row: {
                    "batch_id": string,"completed_on": string | null,"course_id": string,"coverage_pct": number | null,"days_late": number | null,"item_id": string,"last_covered_on": string | null,"owner_member_id": string | null,"phase_label": string | null,"plan_id": string,"planned_end": string | null,"planned_start": string | null,"status": string | null,"tenant_id": string,"title": string,"weight": number
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "syllabus_items_tenant_id_owner_member_id_fkey"
      columns: ["tenant_id","owner_member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "syllabus_items_tenant_id_plan_id_fkey"
      columns: ["tenant_id","plan_id"]
isOneToOne: false
      referencedRelation: "syllabus_plans"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                }
          }
          Functions: {
            "apply_coupon":
{ Args: { "p_code": string,"p_order_id": string }; Returns: Json
                           },
"begin_refund":
{ Args: { "p_amount_minor": number,"p_order_id": string,"p_reason": string,"p_revoke_access": boolean,"p_staff_member": string }; Returns: Json
                           },
"bootstrap_tenant":
{ Args: { "p_owner_email": string,"p_owner_name": string,"p_owner_user_id": string,"p_tenant_id": string,"p_vertical"?: Json }; Returns: string
                           },
"claim_outbox_events":
{ Args: { "p_limit"?: number }; Returns: {
              "aggregate_id": string | null,
"aggregate_type": string | null,
"attempts": number,
"available_at": string,
"created_at": string,
"event_type": string,
"id": string,
"last_error": string | null,
"payload": NonNullable<Json>,
"published_at": string | null,
"tenant_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "outbox_events"
        isOneToOne: false
        isSetofReturn: true
      } },
"create_order":
{ Args: { "p_price_id"?: string,"p_product_id": string }; Returns: Json
                           },
"delete_quiz_question":
{ Args: { "p_question_id": string,"p_test_id": string }; Returns: undefined
                           },
"enroll_in_course":
{ Args: { "p_course_id": string }; Returns: string
                           },
"finish_outbox_event":
{ Args: { "p_error"?: string,"p_id": string }; Returns: undefined
                           },
"finish_refund":
{ Args: { "p_gateway_refund_id"?: string,"p_ok": boolean,"p_refund_id": string }; Returns: Json
                           },
"fulfil_order":
{ Args: { "p_amount_minor": number,"p_gateway": string,"p_gateway_order_id": string,"p_gateway_payment_id": string,"p_method"?: string,"p_order_id": string,"p_raw"?: Json }; Returns: Json
                           },
"get_attempt_paper":
{ Args: { "p_attempt_id": string }; Returns: Json
                           },
"get_attempt_result":
{ Args: { "p_attempt_id": string }; Returns: Json
                           },
"get_leaderboard":
{ Args: { "p_key": string,"p_limit"?: number }; Returns: Json
                           },
"get_test_overview":
{ Args: { "p_test_id": string }; Returns: Json
                           },
"grant_enrollment":
{ Args: { "p_course_id": string,"p_expires_at"?: string,"p_member_id": string }; Returns: string
                           },
"join_tenant":
{ Args: { "p_display_name"?: string,"p_tenant_id": string }; Returns: string
                           },
"update_my_profile":
{ Args: { "p_certificate_name": string,"p_city": string,"p_display_name": string,"p_phone": string,"p_tenant_id": string }; Returns: Json
                           },
"my_sessions":
{ Args: Record<PropertyKey, never>; Returns: { id: string; user_agent: string | null; created_at: string; last_seen: string; is_current: boolean }[]
                           },
"end_my_session":
{ Args: { "p_session_id": string }; Returns: boolean
                           },
"issue_email_code":
{ Args: { "p_member_id": string }; Returns: Json
                           },
"verify_email_code":
{ Args: { "p_code": string,"p_tenant_id": string }; Returns: Json
                           },
"add_to_learner_list":
{ Args: { "p_batch_id": string | null,"p_course_id": string,"p_entries": Json,"p_expires": string | null,"p_tenant_id": string }; Returns: Json
                           },
"remove_from_learner_list":
{ Args: { "p_id": string }; Returns: string
                           },
"extend_learner_list_entry":
{ Args: { "p_expires": string,"p_id": string }; Returns: string
                           },
"claim_my_list_access":
{ Args: { "p_tenant_id": string }; Returns: string
                           },
"submit_upi_payment":
{ Args: { "p_order_id": string }; Returns: Json
                           },
"attach_payment_proof":
{ Args: { "p_file_path": string | null,"p_proof_id": string,"p_utr": string | null }; Returns: undefined
                           },
"cancel_stale_orders":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"approve_upi_payment":
{ Args: { "p_money_seen"?: boolean,"p_proof": string,"p_whatsapp_seen"?: boolean }; Returns: Json
                           },
"reject_upi_payment":
{ Args: { "p_note"?: string | null,"p_proof": string,"p_reason": string }; Returns: Json
                           },
"save_upi_settings":
{ Args: { "p_settings": Json,"p_tenant_id": string }; Returns: Json
                           },
"my_access":
{ Args: { "p_tenant_id": string }; Returns: Json
                           },
"my_lesson_locks":
{ Args: { "p_course_id": string }; Returns: {
              "blocking_lesson_id": string,"lesson_id": string,"reason": string,"unlocks_at": string
            }[]
                           },
"read_gateway_account":
{ Args: { "p_tenant_id": string }; Returns: {
              "gateway": string,"mode": string,"public_key": string,"secret": string,"webhook_secret": string
            }[]
                           },
"record_lesson_progress":
{ Args: { "p_delta_seconds"?: number,"p_lesson_id": string,"p_mark_complete"?: boolean,"p_position_seconds"?: number,"p_progress_pct"?: number }; Returns: Json
                           },
"remove_coupon":
{ Args: { "p_order_id": string }; Returns: Json
                           },
"revoke_certificate":
{ Args: { "p_certificate_id": string,"p_reason"?: string }; Returns: undefined
                           },
"revoke_enrollment":
{ Args: { "p_enrollment_id": string,"p_reason"?: string }; Returns: undefined
                           },
"save_attempt_answer":
{ Args: { "p_attempt_id": string,"p_flagged"?: boolean,"p_question_id": string,"p_response": Json,"p_time_spent"?: number }; Returns: Json
                           },
"save_gateway_account":
{ Args: { "p_gateway": string,"p_mode": string,"p_public_key": string,"p_secret": string,"p_tenant_id": string,"p_webhook_secret": string }; Returns: string
                           },
"save_quiz_question":
{ Args: { "p_correct": (string)[],"p_explanation": string,"p_marks": number,"p_options": Json,"p_question_id": string,"p_test_id": string,"p_text": string,"p_type": string }; Returns: string
                           },
"start_test_attempt":
{ Args: { "p_test_id": string }; Returns: string
                           },
"submit_test_attempt":
{ Args: { "p_attempt_id": string }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
