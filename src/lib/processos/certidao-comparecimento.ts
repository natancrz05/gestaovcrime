export interface DadosCertidaoComparecimento {
  numero: string;
  pessoa: string;
  cpf: string;
  data: string;
  analista: string;
}

export function digitosCpf(valor: string): string {
  return valor.replace(/\D/g, "").slice(0, 11);
}

export function formatarCpf(valor: string): string {
  const d = digitosCpf(valor);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function cpfValido(valor: string): boolean {
  const d = digitosCpf(valor);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;

  const calcular = (tamanho: number) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i += 1) soma += Number(d[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calcular(9) === Number(d[9]) && calcular(10) === Number(d[10]);
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function dataPorExtenso(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  if (!ano || !mes || !dia || mes < 1 || mes > 12) return dataIso;
  return `${dia} de ${MESES[mes - 1]} de ${ano}`;
}

const escaparHtml = (valor: string) =>
  valor.replace(/[&<>"']/g, (caractere) => {
    const mapa: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return mapa[caractere] ?? caractere;
  });

export function montarHtmlCertidaoComparecimento(dados: DadosCertidaoComparecimento): string {
  const numero = escaparHtml(dados.numero);
  const pessoa = escaparHtml(dados.pessoa.toUpperCase());
  const cpf = escaparHtml(formatarCpf(dados.cpf));
  const data = escaparHtml(dataPorExtenso(dados.data));
  const analista = escaparHtml(dados.analista.trim().toUpperCase());

  const via = `
    <section class="via">
      <div class="cabecalho">
        <div>JUÍZO DE DIREITO DA VARA PLENA DA COMARCA DE</div>
        <div>CORAÇÃO DE MARIA</div>
      </div>

      <div class="titulo">CERTIDÃO DE COMPARECIMENTO</div>

      <p class="processo"><strong>Processo nº:</strong> ${numero}</p>

      <p class="texto">
        CERTIFICO para os devidos fins que o(a) Sr(a) <strong>${pessoa}</strong>,
        portador do CPF nº <strong>${cpf}</strong>, compareceu nesta comarca em
        cumprimento ao quanto determinado nos autos. O referido é verdade e dou fé.
        Coração de Maria/BA, ${data}. Eu, _______ <strong>${analista}</strong>,
        Analista Judiciário.
      </p>

      <div class="assinatura">
        <div class="linha"></div>
        <div class="nome-assinatura">${pessoa}</div>
      </div>
    </section>
  `;

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Certidão de Comparecimento — ${numero}</title>
  <style>
    @page { size: A4; margin: 10mm 14mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    body { font-family: "Times New Roman", Times, serif; font-size: 12pt; }
    .acoes {
      position: sticky; top: 0; z-index: 10; display: flex; justify-content: center;
      padding: 8px; background: #f3f4f6; border-bottom: 1px solid #d1d5db;
      font-family: Arial, sans-serif;
    }
    .acoes button { padding: 8px 16px; cursor: pointer; }
    .via {
      min-height: 132mm;
      padding: 4mm 5mm 3mm;
      display: flex;
      flex-direction: column;
    }
    .via + .via { border-top: 1px dashed #888; padding-top: 8mm; }
    .cabecalho { text-align: center; font-weight: 700; line-height: 1.35; }
    .titulo { margin: 9mm 0 8mm; text-align: center; font-weight: 700; }
    .processo { margin: 0 0 8mm; }
    .texto { margin: 0; text-align: justify; line-height: 1.55; }
    .assinatura { margin-top: 15mm; text-align: center; }
    .linha { width: 95mm; margin: 0 auto 2mm; border-top: 1px solid #000; }
    .nome-assinatura { font-weight: 700; }
    @media print {
      .acoes { display: none; }
    }
  </style>
</head>
<body>
  <div class="acoes"><button type="button" onclick="window.print()">Imprimir certidão</button></div>
  ${via}
  ${via}
</body>
</html>`;
}
