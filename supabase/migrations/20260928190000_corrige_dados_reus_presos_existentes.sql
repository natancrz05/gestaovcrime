-- Corrige registros existentes sem apagar ou recriar cadastros.
-- Fonte: planilha oficial fornecida pelo usuário. Identificação por RJI numérico.
-- Os 3 registros sem RJI numérico não são alterados para evitar suposições.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT * FROM (VALUES
      ('267318536-10','CAÍQUE DE JESUS','PREVENTIVA','Prisão preventiva','Vencido'),
      ('235064650-80','CARLOS ANTONIO COUTINHO ANUNCIACAO','EXECUÇÃO PROVISÓRIA','Outra','Dentro da Validade'),
      ('256767552-24','ERIC SILVA DE JESUS','PREVENTIVA','Prisão preventiva','Dentro da Validade'),
      ('256360677-18','ERIVALDO DE LISBOA FIGUEREDO','PREVENTIVA','Prisão preventiva','dentro da Validade'),
      ('267486214-66','FRANCISCO DE AQUINO BRITO','PREVENTIVA','Prisão preventiva','Vencido'),
      ('256950489-02','GABRIEL DE SOUZA FERREIRA','PREVENTIVA','Prisão preventiva','Dentro da Validade'),
      ('267084933-19','GILVAN DOS SANTOS BARBOSA','PREVENTIVA','Prisão preventiva','Vencido'),
      ('267053881-66','IVÃ DE JESUS CERQUEIRA','PREVENTIVA','Prisão preventiva','Vencido'),
      ('267253658-62','JEAN LEAL FERREIRA','PREVENTIVA','Prisão preventiva','Dentro da Validade'),
      ('224644573-00','JEMERSSON DOS SANTOS DA CONCEIÇÃO','PREVENTIVA','Prisão preventiva','Vencido'),
      ('180808279-00','JOABSON  COUTINHO DA CONCEIÇÃO','PREVENTIVA','Prisão preventiva','Vencido'),
      ('267366370-01','JOABSON DE SOUZA RAMOS','PREVENTIVA','Prisão preventiva','Vencido'),
      ('267617675-41','KAIQUE BORGES DA SILVA','PREVENTIVA','Prisão preventiva','Vencido'),
      ('256310816-07','LISSANDRA DE CARVALHO BRITO GOMES BARBOSA','DOMICILIAR','Outra','Vencido'),
      ('180965441-04','LEANDRO DOS REIS','TEMPORÁRIA','Prisão temporária',''),
      ('267509100-38','LUCIANO FIGUEREDO FERREIRA','PREVENTIVA','Prisão preventiva',''),
      ('180889609-78','LUIZ ALBERTO SILVA GUEDES DE JESUS','PREVENTIVA','Prisão preventiva','Vencido'),
      ('267462482-29','LUIS EDUARDO SANTANA DE FREITAS','PREVENTIVA','Prisão preventiva','Vencido'),
      ('256310402-42','LUISE DE CARVALHO BRITO GOMES','DOMICILIAR','Outra','Vencido'),
      ('267328989-27','MARCELO DA SILVA CALÇADA','PREVENTIVA','Prisão preventiva','Vencido'),
      ('256936972-02','MARCOS DANIEL DE BRITO COUTO','PREVENTIVA','Prisão preventiva','Vencido'),
      ('267656580-70','MARINALDO EUSEBIO DA SILVA JUNIOR','PREVENTIVA','Prisão preventiva','Vencido'),
      ('256934070-69','MATHEUS DE JESUS DE OLIVEIRA','PREVENTIVA','Prisão preventiva','Dentro da Validade'),
      ('245527471-49','MAURICIO BRITO SANTOS','PREVENTIVA','Prisão preventiva','Vencido'),
      ('267716671-08','MICAEL FERREIRA SANTOS','TEMPORÁRIA','Prisão temporária','Dentro da Validade'),
      ('256484313-04','NATANAEL GONZAGA','PREVENTIVA','Prisão preventiva','Vencido'),
      ('256950470-94','ODVAN PEREIRA DE SANTANA','PREVENTIVA','Prisão preventiva',''),
      ('256950470-94','ODVAN PEREIRA DE SANTANA','PREVENTIVA','Prisão preventiva','Vencido'),
      ('256778753-39','PAULO VINÍCIUS DA SILVA MOURA','PREVENTIVA','Prisão preventiva','Vencido'),
      ('224644616-85','REINALDO DE JESUS ALMEIDA','PREVENTIVA','Prisão preventiva','Vencido'),
      ('267187016-40','RONEY GLEISON DE SOUZA LIRA','PREVENTIVA','Prisão preventiva','DENTRO DA VALIDADE'),
      ('256556799-44','TAISLAN DE JESUS BITENCOURT','PREVENTIVA','Prisão preventiva',''),
      ('267462147-58','THACIANE SANTOS SANTANA','PREVENTIVA','Prisão preventiva','Vencido'),
      ('256896169-37','UESLEI SANTOS PEREIRA','PREVENTIVA','Prisão preventiva',''),
      ('256310776-77','VERONE ALVES DE JESUS CARNEIRO','DOMICILIAR','Outra','Vencido')
    ) AS x(rji,nome,especie,tipo_prisao,situacao)
  LOOP
    UPDATE public.reus r
       SET nome = left(f.nome,200),
           especie_cautelar = left(f.especie,200),
           tipo_prisao = f.tipo_prisao,
           situacao = CASE WHEN nullif(trim(f.situacao),'') IS NOT NULL THEN left(f.situacao,200) ELSE r.situacao END
     WHERE regexp_replace(coalesce(r.rji,''),'\s','','g') = f.rji;
  END LOOP;
END $$;

UPDATE public.reus
SET tipo_prisao = CASE
  WHEN regexp_replace(upper(unaccent_safe(coalesce(especie_cautelar,''))),'\s+',' ','g') LIKE '%PREVENT%' THEN 'Prisão preventiva'
  WHEN regexp_replace(upper(unaccent_safe(coalesce(especie_cautelar,''))),'\s+',' ','g') LIKE '%TEMPOR%' THEN 'Prisão temporária'
  WHEN regexp_replace(upper(unaccent_safe(coalesce(especie_cautelar,''))),'\s+',' ','g') LIKE '%FLAGRAN%' THEN 'Prisão em flagrante'
  ELSE 'Outra'
END
WHERE preso = true AND nullif(trim(especie_cautelar),'') IS NOT NULL;
