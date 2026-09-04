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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: number
          new_values: Json | null
          old_values: Json | null
          operation: string
          record_id: string | null
          table_name: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_values?: Json | null
          old_values?: Json | null
          operation: string
          record_id?: string | null
          table_name: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_values?: Json | null
          old_values?: Json | null
          operation?: string
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      calculation_rule_versions: {
        Row: {
          change_reason: string
          code: string
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          specification: Json
          status: string
          version: number
        }
        Insert: {
          change_reason: string
          code: string
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          specification: Json
          status?: string
          version: number
        }
        Update: {
          change_reason?: string
          code?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          specification?: Json
          status?: string
          version?: number
        }
        Relationships: []
      }
      catalog_import_batches: {
        Row: { completed_at: string | null; created_at: string; created_by: string | null; id: string; importer_version: string; source_file: string; source_sha256: string; status: string; summary: Json }
        Insert: { completed_at?: string | null; created_at?: string; created_by?: string | null; id?: string; importer_version: string; source_file: string; source_sha256: string; status?: string; summary?: Json }
        Update: { completed_at?: string | null; created_at?: string; created_by?: string | null; id?: string; importer_version?: string; source_file?: string; source_sha256?: string; status?: string; summary?: Json }
        Relationships: []
      }
      catalog_import_issues: {
        Row: { code: string; created_at: string; detail: string; id: string; import_batch_id: string; raw_data: Json | null; resolution_notes: string | null; resolved_at: string | null; resolved_by: string | null; sku: string | null; source_row: number | null; source_sheet: string; status: string }
        Insert: { code: string; created_at?: string; detail: string; id?: string; import_batch_id: string; raw_data?: Json | null; resolution_notes?: string | null; resolved_at?: string | null; resolved_by?: string | null; sku?: string | null; source_row?: number | null; source_sheet: string; status?: string }
        Update: { code?: string; created_at?: string; detail?: string; id?: string; import_batch_id?: string; raw_data?: Json | null; resolution_notes?: string | null; resolved_at?: string | null; resolved_by?: string | null; sku?: string | null; source_row?: number | null; source_sheet?: string; status?: string }
        Relationships: [{ foreignKeyName: "catalog_import_issues_import_batch_id_fkey"; columns: ["import_batch_id"]; isOneToOne: false; referencedRelation: "catalog_import_batches"; referencedColumns: ["id"] }]
      }
      fiscal_rules: {
        Row: {
          active: boolean
          code: string
          created_at: string
          has_st: boolean
          id: string
          name: string
          output_icms_north_northeast_rate: number
          output_icms_south_southeast_rate: number
          output_icms_sp_rate: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          has_st: boolean
          id?: string
          name: string
          output_icms_north_northeast_rate?: number
          output_icms_south_southeast_rate?: number
          output_icms_sp_rate?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          has_st?: boolean
          id?: string
          name?: string
          output_icms_north_northeast_rate?: number
          output_icms_south_southeast_rate?: number
          output_icms_sp_rate?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      margin_classifications: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          label: string
          max_percent: number | null
          min_percent: number | null
          tone: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          max_percent?: number | null
          min_percent?: number | null
          tone: string
          version: number
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          max_percent?: number | null
          min_percent?: number | null
          tone?: string
          version?: number
        }
        Relationships: []
      }
      marketplace_fee_bands: {
        Row: {
          fixed_fee: number
          id: string
          label: string
          max_price: number | null
          min_price: number
          percentage_rate: number
          rule_set_id: string
          sort_order: number
        }
        Insert: {
          fixed_fee?: number
          id?: string
          label: string
          max_price?: number | null
          min_price: number
          percentage_rate: number
          rule_set_id: string
          sort_order: number
        }
        Update: {
          fixed_fee?: number
          id?: string
          label?: string
          max_price?: number | null
          min_price?: number
          percentage_rate?: number
          rule_set_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_fee_bands_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "marketplace_fee_rule_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_fee_rule_sets: {
        Row: {
          change_reason: string
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          listing_type: string
          marketplace_id: string
          name: string
          status: string
          version: number
        }
        Insert: {
          change_reason: string
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          listing_type?: string
          marketplace_id: string
          name: string
          status?: string
          version: number
        }
        Update: {
          change_reason?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          listing_type?: string
          marketplace_id?: string
          name?: string
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_fee_rule_sets_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplaces: {
        Row: {
          active: boolean
          adapter_key: string
          code: string
          created_at: string
          id: string
          name: string
          shipping_mode: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          adapter_key: string
          code: string
          created_at?: string
          id?: string
          name: string
          shipping_mode?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          adapter_key?: string
          code?: string
          created_at?: string
          id?: string
          name?: string
          shipping_mode?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      pricing_calculations: {
        Row: {
          calculation_rule_version_id: string | null
          created_at: string
          created_by: string
          fee_rule_set_id: string | null
          id: string
          input_snapshot: Json
          listing_type: string
          marketplace_id: string
          product_id: string
          results: Json
          rule_snapshot: Json
          sale_price: number
          shipping_cost: number
          shipping_rule_set_id: string | null
        }
        Insert: {
          calculation_rule_version_id?: string | null
          created_at?: string
          created_by?: string
          fee_rule_set_id?: string | null
          id?: string
          input_snapshot: Json
          listing_type: string
          marketplace_id: string
          product_id: string
          results: Json
          rule_snapshot: Json
          sale_price: number
          shipping_cost?: number
          shipping_rule_set_id?: string | null
        }
        Update: {
          calculation_rule_version_id?: string | null
          created_at?: string
          created_by?: string
          fee_rule_set_id?: string | null
          id?: string
          input_snapshot?: Json
          listing_type?: string
          marketplace_id?: string
          product_id?: string
          results?: Json
          rule_snapshot?: Json
          sale_price?: number
          shipping_cost?: number
          shipping_rule_set_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_calculations_calculation_rule_version_id_fkey"
            columns: ["calculation_rule_version_id"]
            isOneToOne: false
            referencedRelation: "calculation_rule_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_calculations_fee_rule_set_id_fkey"
            columns: ["fee_rule_set_id"]
            isOneToOne: false
            referencedRelation: "marketplace_fee_rule_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_calculations_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_calculations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_marketplace_configs: {
        Row: {
          active: boolean
          commission_rate_override: number | null
          created_at: string
          current_sale_price: number | null
          fixed_fee_override: number | null
          freight_cost: number | null
          id: string
          listing_type: string
          marketplace_id: string
          product_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          commission_rate_override?: number | null
          created_at?: string
          current_sale_price?: number | null
          fixed_fee_override?: number | null
          freight_cost?: number | null
          id?: string
          listing_type?: string
          marketplace_id: string
          product_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          commission_rate_override?: number | null
          created_at?: string
          current_sale_price?: number | null
          fixed_fee_override?: number | null
          freight_cost?: number | null
          id?: string
          listing_type?: string
          marketplace_id?: string
          product_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_marketplace_configs_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_marketplace_configs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sources: {
        Row: { id: string; import_batch_id: string; imported_at: string; product_id: string; source_payload: Json; source_row: number; source_sheet: string }
        Insert: { id?: string; import_batch_id: string; imported_at?: string; product_id: string; source_payload: Json; source_row: number; source_sheet: string }
        Update: { id?: string; import_batch_id?: string; imported_at?: string; product_id?: string; source_payload?: Json; source_row?: number; source_sheet?: string }
        Relationships: [
          { foreignKeyName: "product_sources_import_batch_id_fkey"; columns: ["import_batch_id"]; isOneToOne: false; referencedRelation: "catalog_import_batches"; referencedColumns: ["id"] },
          { foreignKeyName: "product_sources_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
        ]
      }
      product_cost_history: {
        Row: { id: string; product_id: string; old_cost: number; new_cost: number; changed_by: string | null; changed_at: string; change_reason: string | null }
        Insert: { id?: string; product_id: string; old_cost: number; new_cost: number; changed_by?: string | null; changed_at?: string; change_reason?: string | null }
        Update: { id?: string; product_id?: string; old_cost?: number; new_cost?: number; changed_by?: string | null; changed_at?: string; change_reason?: string | null }
        Relationships: [{ foreignKeyName: "product_cost_history_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] }]
      }
      products: {
        Row: {
          active: boolean
          cost: number
          created_at: string
          cubic_weight_kg: number | null
          fiscal_rule_id: string
          fixed_price: number | null
          has_fixed_price: boolean
          id: string
          input_cofins_rate: number
          input_icms_rate: number
          input_ipi_rate: number
          input_pis_rate: number
          manufacturer_code: string | null
          name: string
          output_icms_north_northeast_rate: number
          output_icms_south_southeast_rate: number
          output_icms_sp_rate: number
          package_height_cm: number | null
          package_length_cm: number | null
          package_weight_kg: number | null
          package_width_cm: number | null
          sku: string
          st_amount: number | null
          supplier_id: string
          units_per_box: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          cost: number
          created_at?: string
          cubic_weight_kg?: number | null
          fiscal_rule_id: string
          fixed_price?: number | null
          has_fixed_price?: boolean
          id?: string
          input_cofins_rate?: number
          input_icms_rate?: number
          input_ipi_rate?: number
          input_pis_rate?: number
          manufacturer_code?: string | null
          name: string
          output_icms_north_northeast_rate?: number
          output_icms_south_southeast_rate?: number
          output_icms_sp_rate?: number
          package_height_cm?: number | null
          package_length_cm?: number | null
          package_weight_kg?: number | null
          package_width_cm?: number | null
          sku: string
          st_amount?: number | null
          supplier_id: string
          units_per_box?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          cost?: number
          created_at?: string
          cubic_weight_kg?: number | null
          fiscal_rule_id?: string
          fixed_price?: number | null
          has_fixed_price?: boolean
          id?: string
          input_cofins_rate?: number
          input_icms_rate?: number
          input_ipi_rate?: number
          input_pis_rate?: number
          manufacturer_code?: string | null
          name?: string
          output_icms_north_northeast_rate?: number
          output_icms_south_southeast_rate?: number
          output_icms_sp_rate?: number
          package_height_cm?: number | null
          package_length_cm?: number | null
          package_weight_kg?: number | null
          package_width_cm?: number | null
          sku?: string
          st_amount?: number | null
          supplier_id?: string
          units_per_box?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_fiscal_rule_id_fkey"
            columns: ["fiscal_rule_id"]
            isOneToOne: false
            referencedRelation: "fiscal_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          display_name: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      repricing_queue: {
        Row: {
          created_at: string
          id: string
          marketplace_id: string | null
          product_id: string
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          source_id: string | null
          source_type: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          marketplace_id?: string | null
          product_id: string
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          source_id?: string | null
          source_type: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          marketplace_id?: string | null
          product_id?: string
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "repricing_queue_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repricing_queue_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_shipping_rule_sets: {
        Row: { id: string; marketplace_id: string; version: number; status: string; effective_from: string; effective_to: string | null; source_url: string; change_reason: string; created_by: string | null; created_at: string }
        Insert: { id?: string; marketplace_id: string; version: number; status?: string; effective_from?: string; effective_to?: string | null; source_url: string; change_reason: string; created_by?: string | null; created_at?: string }
        Update: { id?: string; marketplace_id?: string; version?: number; status?: string; effective_from?: string; effective_to?: string | null; source_url?: string; change_reason?: string; created_by?: string | null; created_at?: string }
        Relationships: [{ foreignKeyName: "marketplace_shipping_rule_sets_marketplace_id_fkey"; columns: ["marketplace_id"]; isOneToOne: false; referencedRelation: "marketplaces"; referencedColumns: ["id"] }]
      }
      shipping_additional_kg_rates: {
        Row: { id: string; rule_set_id: string; price_band_id: string; cost_per_kg: number }
        Insert: { id?: string; rule_set_id: string; price_band_id: string; cost_per_kg: number }
        Update: { id?: string; rule_set_id?: string; price_band_id?: string; cost_per_kg?: number }
        Relationships: [
          { foreignKeyName: "shipping_additional_kg_rates_rule_set_id_fkey"; columns: ["rule_set_id"]; isOneToOne: false; referencedRelation: "marketplace_shipping_rule_sets"; referencedColumns: ["id"] },
          { foreignKeyName: "shipping_additional_kg_rates_price_band_id_fkey"; columns: ["price_band_id"]; isOneToOne: false; referencedRelation: "shipping_price_bands"; referencedColumns: ["id"] },
        ]
      }
      shipping_price_bands: {
        Row: { id: string; rule_set_id: string; label: string; max_price: number | null; sort_order: number }
        Insert: { id?: string; rule_set_id: string; label: string; max_price?: number | null; sort_order: number }
        Update: { id?: string; rule_set_id?: string; label?: string; max_price?: number | null; sort_order?: number }
        Relationships: [{ foreignKeyName: "shipping_price_bands_rule_set_id_fkey"; columns: ["rule_set_id"]; isOneToOne: false; referencedRelation: "marketplace_shipping_rule_sets"; referencedColumns: ["id"] }]
      }
      shipping_weight_bands: {
        Row: { id: string; rule_set_id: string; label: string; max_weight_kg: number | null; sort_order: number }
        Insert: { id?: string; rule_set_id: string; label: string; max_weight_kg?: number | null; sort_order: number }
        Update: { id?: string; rule_set_id?: string; label?: string; max_weight_kg?: number | null; sort_order?: number }
        Relationships: [{ foreignKeyName: "shipping_weight_bands_rule_set_id_fkey"; columns: ["rule_set_id"]; isOneToOne: false; referencedRelation: "marketplace_shipping_rule_sets"; referencedColumns: ["id"] }]
      }
      shipping_rates: {
        Row: { id: string; rule_set_id: string; price_band_id: string; weight_band_id: string; cost: number }
        Insert: { id?: string; rule_set_id: string; price_band_id: string; weight_band_id: string; cost: number }
        Update: { id?: string; rule_set_id?: string; price_band_id?: string; weight_band_id?: string; cost?: number }
        Relationships: [
          { foreignKeyName: "shipping_rates_rule_set_id_fkey"; columns: ["rule_set_id"]; isOneToOne: false; referencedRelation: "marketplace_shipping_rule_sets"; referencedColumns: ["id"] },
          { foreignKeyName: "shipping_rates_price_band_id_fkey"; columns: ["price_band_id"]; isOneToOne: false; referencedRelation: "shipping_price_bands"; referencedColumns: ["id"] },
          { foreignKeyName: "shipping_rates_weight_band_id_fkey"; columns: ["weight_band_id"]; isOneToOne: false; referencedRelation: "shipping_weight_bands"; referencedColumns: ["id"] },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          logo_path: string | null
          name: string
          normalized_name: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          logo_path?: string | null
          name: string
          normalized_name?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          logo_path?: string | null
          name?: string
          normalized_name?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      publish_amazon_shipping_rule: { Args: { payload: Json; reason: string }; Returns: string }
      publish_ml_shipping_rule: { Args: { payload: Json; reason: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
