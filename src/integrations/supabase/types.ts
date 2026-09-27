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
          aguardando_nova_data: boolean
          criado_em: string
          data: string
          data_realizacao: string | null
          datas_anteriores: Json
          horario: string | null
          id: string
          local: string
          modalidade: string
          observacao: string
          ocultar_selo_reu_preso: boolean
          processo_id: string
          situacao: string
          tipo: string
        }
        Insert: {
          aguardando_nova_data?: boolean
          criado_em?: string
          data: string
          data_realizacao?: string | null
          datas_anteriores?: Json
          horario?: string | null
          id?: string
          local?: string
          modalidade?: string
          observacao?: string
          ocultar_selo_reu_preso?: boolean
          processo_id: string
          situacao?: string
          tipo?: string
        }
        Update: {
          aguardando_nova_data?: boolean
          criado_em?: string
          data?: string
          data_realizacao?: string | null
          datas_anteriores?: Json
          horario?: string | null
          id?: string
          local?: string
          modalidade?: string
          observacao?: string
          ocultar_selo_reu_preso?: boolean
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
      comparecimento_registros: {
        Row: {
          comparecimento_id: string
          criado_em: string
          data_prevista: string
          data_realizada: string
          id: string
          observacao: string
          processo_id: string
          situacao: string
        }
        Insert: {
          comparecimento_id: string
          criado_em?: string
          data_prevista: string
          data_realizada: string
          id?: string
          observacao?: string
          processo_id: string
          situacao: string
        }
        Update: {
          comparecimento_id?: string
          criado_em?: string
          data_prevista?: string
          data_realizada?: string
          id?: string
          observacao?: string
          processo_id?: string
          situacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "comparecimento_registros_comparecimento_id_fkey"
            columns: ["comparecimento_id"]
            isOneToOne: false
            referencedRelation: "comparecimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparecimento_registros_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      comparecimentos: {
        Row: {
          conferir: boolean
          cpf: string
          criado_em: string
          dados_planilha: Json
          data_inicio: string
          id: string
          intervalo_meses: number
          motivo_conferencia: string
          numeros_informados: string[]
          observacao: string
          periodicidade: string
          pessoa: string
          processo_id: string | null
          proximo: string
          situacao: string
        }
        Insert: {
          conferir?: boolean
          cpf?: string
          criado_em?: string
          dados_planilha?: Json
          data_inicio: string
          id?: string
          intervalo_meses?: number
          motivo_conferencia?: string
          numeros_informados?: string[]
          observacao?: string
          periodicidade?: string
          pessoa: string
          processo_id?: string | null
          proximo: string
          situacao?: string
        }
        Update: {
          conferir?: boolean
          cpf?: string
          criado_em?: string
          dados_planilha?: Json
          data_inicio?: string
          id?: string
          intervalo_meses?: number
          motivo_conferencia?: string
          numeros_informados?: string[]
          observacao?: string
          periodicidade?: string
          pessoa?: string
          processo_id?: string | null
          proximo?: string
          situacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "comparecimentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      importacao_itens: {
        Row: {
          acao: string
          antes: Json
          depois: Json
          desfeito: string | null
          id: string
          importacao_id: string
          linha: number | null
          movimentacao_id: string | null
          numero: string
          processo_id: string | null
          reus_ids: string[]
        }
        Insert: {
          acao: string
          antes?: Json
          depois?: Json
          desfeito?: string | null
          id?: string
          importacao_id: string
          linha?: number | null
          movimentacao_id?: string | null
          numero: string
          processo_id?: string | null
          reus_ids?: string[]
        }
        Update: {
          acao?: string
          antes?: Json
          depois?: Json
          desfeito?: string | null
          id?: string
          importacao_id?: string
          linha?: number | null
          movimentacao_id?: string | null
          numero?: string
          processo_id?: string | null
          reus_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "importacao_itens_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "importacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      importacoes: {
        Row: {
          analisados: number
          arquivo: string
          atualizados: number
          conflitos: number
          criado_em: string
          desfeita_em: string | null
          desfeita_por: string | null
          detalhes: Json
          erros: number
          id: string
          ignorados: number
          novos: number
          numero: number
          sem_alteracao: number
          status: string
          usuario_id: string | null
          usuario_nome: string
        }
        Insert: {
          analisados?: number
          arquivo?: string
          atualizados?: number
          conflitos?: number
          criado_em?: string
          desfeita_em?: string | null
          desfeita_por?: string | null
          detalhes?: Json
          erros?: number
          id?: string
          ignorados?: number
          novos?: number
          numero?: number
          sem_alteracao?: number
          status?: string
          usuario_id?: string | null
          usuario_nome?: string
        }
        Update: {
          analisados?: number
          arquivo?: string
          atualizados?: number
          conflitos?: number
          criado_em?: string
          desfeita_em?: string | null
          desfeita_por?: string | null
          detalhes?: Json
          erros?: number
          id?: string
          ignorados?: number
          novos?: number
          numero?: number
          sem_alteracao?: number
          status?: string
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
          conferir: boolean
          criado_em: string
          data_distribuicao: string | null
          fase: string
          id: string
          id_externo: string | null
          numero: string
          observacao_geral: string
          origem: string
          pje_autor: string | null
          pje_classe_codigo: string | null
          pje_concluso: string | null
          pje_descricao_prioridade: string | null
          pje_localizacao: string | null
          pje_prioridade: string | null
          pje_qtde_dias: number | null
          pje_reu: string | null
          pje_segredo: string | null
          pje_sistema: string | null
          pje_situacao: string | null
          pje_tarefas: string | null
          pje_ultima_mov_data: string | null
          pje_ultima_mov_descricao: string | null
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
          conferir?: boolean
          criado_em?: string
          data_distribuicao?: string | null
          fase?: string
          id?: string
          id_externo?: string | null
          numero: string
          observacao_geral?: string
          origem?: string
          pje_autor?: string | null
          pje_classe_codigo?: string | null
          pje_concluso?: string | null
          pje_descricao_prioridade?: string | null
          pje_localizacao?: string | null
          pje_prioridade?: string | null
          pje_qtde_dias?: number | null
          pje_reu?: string | null
          pje_segredo?: string | null
          pje_sistema?: string | null
          pje_situacao?: string | null
          pje_tarefas?: string | null
          pje_ultima_mov_data?: string | null
          pje_ultima_mov_descricao?: string | null
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
          conferir?: boolean
          criado_em?: string
          data_distribuicao?: string | null
          fase?: string
          id?: string
          id_externo?: string | null
          numero?: string
          observacao_geral?: string
          origem?: string
          pje_autor?: string | null
          pje_classe_codigo?: string | null
          pje_concluso?: string | null
          pje_descricao_prioridade?: string | null
          pje_localizacao?: string | null
          pje_prioridade?: string | null
          pje_qtde_dias?: number | null
          pje_reu?: string | null
          pje_segredo?: string | null
          pje_sistema?: string | null
          pje_situacao?: string | null
          pje_tarefas?: string | null
          pje_ultima_mov_data?: string | null
          pje_ultima_mov_descricao?: string | null
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
      reu_prisoes_encerradas: {
        Row: {
          criado_em: string
          dados_planilha: Json
          data_encerramento: string
          data_prisao: string | null
          especie_cautelar: string
          id: string
          motivo: string
          processo_id: string | null
          reu_id: string
          situacao_anterior: string
          tipo_prisao: string
          usuario_nome: string
        }
        Insert: {
          criado_em?: string
          dados_planilha?: Json
          data_encerramento: string
          data_prisao?: string | null
          especie_cautelar?: string
          id?: string
          motivo?: string
          processo_id?: string | null
          reu_id: string
          situacao_anterior?: string
          tipo_prisao?: string
          usuario_nome?: string
        }
        Update: {
          criado_em?: string
          dados_planilha?: Json
          data_encerramento?: string
          data_prisao?: string | null
          especie_cautelar?: string
          id?: string
          motivo?: string
          processo_id?: string | null
          reu_id?: string
          situacao_anterior?: string
          tipo_prisao?: string
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "reu_prisoes_encerradas_reu_id_fkey"
            columns: ["reu_id"]
            isOneToOne: false
            referencedRelation: "reus"
            referencedColumns: ["id"]
          },
        ]
      }
      reu_reavaliacoes: {
        Row: {
          criado_em: string
          data_reavaliacao: string
          id: string
          observacao: string
          proxima_data: string | null
          reu_id: string
          usuario_nome: string
        }
        Insert: {
          criado_em?: string
          data_reavaliacao: string
          id?: string
          observacao?: string
          proxima_data?: string | null
          reu_id: string
          usuario_nome?: string
        }
        Update: {
          criado_em?: string
          data_reavaliacao?: string
          id?: string
          observacao?: string
          proxima_data?: string | null
          reu_id?: string
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "reu_reavaliacoes_reu_id_fkey"
            columns: ["reu_id"]
            isOneToOne: false
            referencedRelation: "reus"
            referencedColumns: ["id"]
          },
        ]
      }
      reus: {
        Row: {
          conferir: boolean
          dados_planilha: Json
          data_prisao: string | null
          especie_cautelar: string
          id: string
          motivo_conferencia: string
          nome: string
          observacoes: string
          ordem: number
          preso: boolean
          processo_id: string | null
          processos_relacionados: Json
          rji: string
          situacao: string
          tipo_prisao: string
        }
        Insert: {
          conferir?: boolean
          dados_planilha?: Json
          data_prisao?: string | null
          especie_cautelar?: string
          id?: string
          motivo_conferencia?: string
          nome: string
          observacoes?: string
          ordem?: number
          preso?: boolean
          processo_id?: string | null
          processos_relacionados?: Json
          rji?: string
          situacao?: string
          tipo_prisao?: string
        }
        Update: {
          conferir?: boolean
          dados_planilha?: Json
          data_prisao?: string | null
          especie_cautelar?: string
          id?: string
          motivo_conferencia?: string
          nome?: string
          observacoes?: string
          ordem?: number
          preso?: boolean
          processo_id?: string | null
          processos_relacionados?: Json
          rji?: string
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
      confirmar_audiencia: {
        Args: { p_data: string; p_id: string; p_obs: string }
        Returns: undefined
      }
      desfazer_importacao: { Args: { p_id: string }; Returns: Json }
      eh_admin: { Args: { _user_id: string }; Returns: boolean }
      encerrar_prisao: {
        Args: { p_data: string; p_motivo: string; p_reu: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      importar_comparecimentos: {
        Args: { p_arquivo: string; p_linhas: Json; p_simular: boolean }
        Returns: Json
      }
      importar_processos: {
        Args: {
          p_aplicar_conflitos: boolean
          p_arquivo: string
          p_erros: Json
          p_ignorados: Json
          p_linhas: Json
          p_simular: boolean
        }
        Returns: Json
      }
      importar_reus_presos: {
        Args: {
          p_arquivo: string
          p_erros: number
          p_linhas: Json
          p_simular: boolean
        }
        Returns: Json
      }
      pode_editar: { Args: { _user_id: string }; Returns: boolean }
      registrar_comparecimento: {
        Args: { p_data: string; p_id: string; p_obs: string }
        Returns: string
      }
      registrar_reavaliacao: {
        Args: {
          p_data: string
          p_obs: string
          p_proxima: string
          p_reu: string
        }
        Returns: undefined
      }
      rotulo_campo_importacao: { Args: { _c: string }; Returns: string }
      unaccent_safe: { Args: { t: string }; Returns: string }
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
