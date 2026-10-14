export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      components: {
        Row: {
          count: number
          description: string | null
          id: string
          image_url: string | null
          location: string | null
          name: string
          reserved: number
          returnable: boolean
          updated_at: string
        }
        Insert: {
          count?: number
          description?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          name: string
          reserved?: number
          returnable?: boolean
          updated_at?: string
        }
        Update: {
          count?: number
          description?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          name?: string
          reserved?: number
          returnable?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      inventory_adjustments: {
        Row: {
          actor_id: string | null
          component_id: string
          created_at: string
          id: number
          new_count: number | null
          new_reserved: number | null
          old_count: number | null
          old_reserved: number | null
          reason: string | null
          source: string | null
        }
        Insert: {
          actor_id?: string | null
          component_id: string
          created_at?: string
          id?: never
          new_count?: number | null
          new_reserved?: number | null
          old_count?: number | null
          old_reserved?: number | null
          reason?: string | null
          source?: string | null
        }
        Update: {
          actor_id?: string | null
          component_id?: string
          created_at?: string
          id?: never
          new_count?: number | null
          new_reserved?: number | null
          old_count?: number | null
          old_reserved?: number | null
          reason?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "component_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          owner_name: string | null
          phone: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          owner_name?: string | null
          phone: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          owner_name?: string | null
          phone?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          count: number
          uid: string
          window_start: string
        }
        Insert: {
          action: string
          count?: number
          uid: string
          window_start?: string
        }
        Update: {
          action?: string
          count?: number
          uid?: string
          window_start?: string
        }
        Relationships: []
      }
      request_events: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["request_status"] | null
          id: number
          note: string | null
          request_id: string
          to_status: Database["public"]["Enums"]["request_status"] | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["request_status"] | null
          id?: never
          note?: string | null
          request_id: string
          to_status?: Database["public"]["Enums"]["request_status"] | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["request_status"] | null
          id?: never
          note?: string | null
          request_id?: string
          to_status?: Database["public"]["Enums"]["request_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_items: {
        Row: {
          approved_qty: number | null
          component_id: string
          condition: Database["public"]["Enums"]["item_condition"] | null
          issued_qty: number | null
          note: string | null
          qty: number
          request_id: string
          returned_qty: number | null
        }
        Insert: {
          approved_qty?: number | null
          component_id: string
          condition?: Database["public"]["Enums"]["item_condition"] | null
          issued_qty?: number | null
          note?: string | null
          qty: number
          request_id: string
          returned_qty?: number | null
        }
        Update: {
          approved_qty?: number | null
          component_id?: string
          condition?: Database["public"]["Enums"]["item_condition"] | null
          issued_qty?: number | null
          note?: string | null
          qty?: number
          request_id?: string
          returned_qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "request_items_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "component_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_items_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          approved_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          issued_at: string | null
          issued_by: string | null
          phone: string
          project_id: string | null
          public_token: string
          reject_reason: string | null
          requester_id: string
          requester_name: string
          returned_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          screenshot_path: string | null
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          phone: string
          project_id?: string | null
          public_token?: string
          reject_reason?: string | null
          requester_id?: string
          requester_name: string
          returned_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_path?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          phone?: string
          project_id?: string | null
          public_token?: string
          reject_reason?: string | null
          requester_id?: string
          requester_name?: string
          returned_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_path?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          active: boolean
          created_at: string
          display_name: string | null
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      component_catalog: {
        Row: {
          available: number | null
          description: string | null
          id: string | null
          image_url: string | null
          name: string | null
          returnable: boolean | null
        }
        Insert: {
          available?: never
          description?: string | null
          id?: string | null
          image_url?: string | null
          name?: string | null
          returnable?: boolean | null
        }
        Update: {
          available?: never
          description?: string | null
          id?: string | null
          name?: string | null
          returnable?: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      adjust_component: {
        Args: { p_component_id: string; p_new_count: number; p_reason: string }
        Returns: undefined
      }
      admin_cancel_request: {
        Args: { p_reason: string; p_request_id: string }
        Returns: undefined
      }
      approve_request: {
        Args: { p_items: Json; p_request_id: string }
        Returns: Json
      }
      cancel_request: { Args: { p_request_id: string }; Returns: undefined }
      commit_inventory_upload: {
        Args: { p_reason: string; p_rows: Json }
        Returns: Json
      }
      expire_stale_approvals: { Args: never; Returns: undefined }
      find_projects: {
        Args: { p_phone: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      get_request_by_token: { Args: { p_token: string }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      issue_request: {
        Args: { p_items?: Json; p_request_id: string }
        Returns: undefined
      }
      preview_inventory_upload: {
        Args: { p_rows: Json }
        Returns: {
          component_id: string
          diff: string
          error: string
          new_count: number
          new_description: string
          new_returnable: boolean
          old_count: number
          old_description: string
          old_returnable: boolean
          row_location: string
          row_name: string
        }[]
      }
      reject_request: {
        Args: { p_reason: string; p_request_id: string }
        Returns: undefined
      }
      resubmit_request: { Args: { p_old_request_id: string }; Returns: Json }
      staff_role: {
        Args: never
        Returns: Database["public"]["Enums"]["staff_role"]
      }
      submit_request: {
        Args: {
          p_items: Json
          p_new_project: Json
          p_phone: string
          p_project_id: string
          p_requester_name: string
          p_screenshot_path: string
        }
        Returns: {
          id: string
          public_token: string
          status: Database["public"]["Enums"]["request_status"]
        }[]
      }
      verify_return: {
        Args: { p_items: Json; p_request_id: string }
        Returns: undefined
      }
    }
    Enums: {
      item_condition: "ok" | "damaged" | "missing"
      request_status:
        | "pending"
        | "approved"
        | "issued"
        | "returned"
        | "rejected"
        | "cancelled"
        | "expired"
      staff_role: "admin" | "inventory_manager"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      item_condition: ["ok", "damaged", "missing"],
      request_status: [
        "pending",
        "approved",
        "issued",
        "returned",
        "rejected",
        "cancelled",
        "expired",
      ],
      staff_role: ["admin", "inventory_manager"],
    },
  },
} as const
