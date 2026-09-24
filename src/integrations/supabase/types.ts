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
      audiencias: {
        Row: {
          criado_em: string
          data: string
          horario: string | null
          id: string
          local: string
          modalidade: string
          observacao: string
          processo_id: string
          situacao: string
          tipo: string
        }
        Insert: {
          criado_em?: string
          data: string
          horario?: string | null
          id?: string
          local?: string
          modalidade?: string
          observacao?: string
          processo_id: string
          situacao?: string
          tipo?: string
        }
        Update: {
          criado_em?: string
          data?: string
          horario?: string | null
          id?: string
          local?: string
          modalidade?: string
          observacao?: string
          processo_id?: string
          situacao?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "audiencias_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria: {
        Row: {
          acao: string
          criado_em: string
          descricao: string
          id: string
          modulo: string
          processo_id: string | null
          processo_numero: string
          registro_id: string | null
          usuario_id: string | null
          usuario_nome: string
        }
        Insert: {
          acao: string
          criado_em?: string
          descricao?: string
          id?: string
          modulo: string
          processo_id?: string | null
          processo_numero?: string
          registro_id?: string | null
          usuario_id?: string | null
          usuario_nome?: string
        }
        Update: {
          acao?: string
          criado_em?: string
          descricao?: string
          id?: string
          modulo?: string
          processo_id?: string | null
          processo_numero?: string
          registro_id?: string | null
          usuario_id?: string | null
          usuario_nome?: string
        }
        Relationships: []
      }
      integracao_log: {
        Row: {
          criado_em: string
          id: string
          mensagem: string
          operacao: string
          processo_id: string | null
          resultado: string
        }
        Insert: {
          criado_em?: string
          id?: string
          mensagem?: string
          operacao: string
          processo_id?: string | null
          resultado: string
        }
        Update: {
          criado_em?: string
          id?: string
          mensagem?: string
          operacao?: string
          processo_id?: string | null
          resultado?: string
        }
        Relationships: [
          {
            foreignKeyName: "integracao_log_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes: {
        Row: {
          criado_em: string
          data: string
          descricao: string
          id: string
          id_externo: string | null
          observacao: string
          origem: string
          processo_id: string
          tipo: string
        }
        Insert: {
          criado_em?: string
          data: string
          descricao: string
          id?: string
          id_externo?: string | null
          observacao?: string
          origem?: string
          processo_id: string
          tipo?: string
        }
        Update: {
          criado_em?: string
          data?: string
          descricao?: string
          id?: string
          id_externo?: string | null
          observacao?: string
          origem?: string
          processo_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      observacoes_internas: {
        Row: {
          criado_em: string
          id: string
          processo_id: string
          texto: string
        }
        Insert: {
          criado_em?: string
          id?: string
          processo_id: string
          texto: string
        }
        Update: {
          criado_em?: string
          id?: string
          processo_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "observacoes_internas_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      partes: {
        Row: {
          id: string
          nome: string
          observacao: string
          processo_id: string
          tipo: string
        }
        Insert: {
          id?: string
          nome: string
          observacao?: string
          processo_id: string
          tipo: string
        }
        Update: {
          id?: string
          nome?: string
          observacao?: string
          processo_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "partes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      pendencias: {
        Row: {
          concluida: boolean
          criado_em: string
          data_conclusao: string | null
          descricao: string
          id: string
          observacoes: string
          prazo: string | null
          prioridade: string
          processo_id: string
          responsavel: string
          status: string
          tipo: string
          titulo: string
        }
        Insert: {
          concluida?: boolean
          criado_em?: string
          data_conclusao?: string | null
          descricao: string
          id?: string
          observacoes?: string
          prazo?: string | null
          prioridade?: string
          processo_id: string
          responsavel?: string
          status?: string
          tipo?: string
          titulo?: string
        }
        Update: {
          concluida?: boolean
          criado_em?: string
          data_conclusao?: string | null
          descricao?: string
          id?: string
          observacoes?: string
          prazo?: string | null
          prioridade?: string
          processo_id?: string
          responsavel?: string
          status?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "pendencias_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      prioridades: {
        Row: {
          criado_em: string
          id: string
          motivo: string
          nivel: string
          observacao: string
          processo_id: string
          titulo: string
        }
        Insert: {
          criado_em?: string
          id?: string
          motivo?: string
          nivel?: string
          observacao?: string
          processo_id: string
          titulo?: string
        }
        Update: {
          criado_em?: string
          id?: string
          motivo?: string
          nivel?: string
          observacao?: string
          processo_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "prioridades_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      processos: {
        Row: {
          assunto: string
          classe: string
          comarca: string
          criado_em: string
          data_distribuicao: string | null
          fase: string
          id: string
          id_externo: string | null
          numero: string
          observacao_geral: string
          origem: string
          responsavel: string
          status: string
          sync_erro: string | null
          sync_status: string
          ultima_alteracao_externa: string | null
          ultima_sincronizacao: string | null
          unidade: string
        }
        Insert: {
          assunto?: string
          classe: string
          comarca?: string
          criado_em?: string
          data_distribuicao?: string | null
          fase?: string
          id?: string
          id_externo?: string | null
          numero: string
          observacao_geral?: string
          origem?: string
          responsavel?: string
          status?: string
          sync_erro?: string | null
          sync_status?: string
          ultima_alteracao_externa?: string | null
          ultima_sincronizacao?: string | null
          unidade?: string
        }
        Update: {
          assunto?: string
          classe?: string
          comarca?: string
          criado_em?: string
          data_distribuicao?: string | null
          fase?: string
          id?: string
          id_externo?: string | null
          numero?: string
          observacao_geral?: string
          origem?: string
          responsavel?: string
          status?: string
          sync_erro?: string | null
          sync_status?: string
          ultima_alteracao_externa?: string | null
          ultima_sincronizacao?: string | null
          unidade?: string
        }
        Relationships: []
      }
      reus: {
        Row: {
          data_prisao: string | null
          id: string
          nome: string
          observacoes: string
          ordem: number
          preso: boolean
          processo_id: string
          situacao: string
          tipo_prisao: string
        }
        Insert: {
          data_prisao?: string | null
          id?: string
          nome: string
          observacoes?: string
          ordem?: number
          preso?: boolean
          processo_id: string
          situacao?: string
          tipo_prisao?: string
        }
        Update: {
          data_prisao?: string | null
          id?: string
          nome?: string
          observacoes?: string
          ordem?: number
          preso?: boolean
          processo_id?: string
          situacao?: string
          tipo_prisao?: string
        }
        Relationships: [
          {
            foreignKeyName: "reus_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          ativo: boolean
          criado_em: string
          email: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          email?: string
          id: string
          nome?: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          email?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auditoria_nome: { Args: { _uid: string }; Returns: string }
      eh_admin: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      pode_editar: { Args: { _user_id: string }; Returns: boolean }
      usuario_ativo: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "administrador" | "servidor" | "consulta"
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
  public: {
    Enums: {
      app_role: ["administrador", "servidor", "consulta"],
    },
  },
} as const
