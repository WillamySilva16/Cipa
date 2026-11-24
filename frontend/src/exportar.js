// Planilha de apuração: total de votos por candidato e lista de quem votou.
// O voto é secreto: as duas coisas ficam em abas separadas e nada liga uma pessoa à sua escolha.

const BRANCO = 'VOTO EM BRANCO'
const FMT_DATA = 'dd/mm/yyyy hh:mm:ss'

const pad = (n) => String(n).padStart(2, '0')

export function nomeDoArquivo(agora = new Date()) {
  const d = `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`
  return `apuracao-cipa-2026-2027_${d}_${pad(agora.getHours())}${pad(agora.getMinutes())}.xlsx`
}

function formatar(XLSX, ws, formatos) {
  // formatos: { 'D': '0.0%' } aplica o formato nas células da coluna (a partir da linha 2)
  const ref = XLSX.utils.decode_range(ws['!ref'])
  for (let r = ref.s.r + 1; r <= ref.e.r; r++) {
    for (const [col, z] of Object.entries(formatos)) {
      const cel = ws[`${col}${r + 1}`]
      if (cel && (cel.t === 'n' || cel.t === 'd')) cel.z = z
    }
  }
}

export function montarPlanilha(XLSX, apuracao, votantes, geradoEm = new Date()) {
  const wb = XLSX.utils.book_new()
  const lista = votantes || []
  const itens = apuracao ? apuracao.itens : []
  const total = apuracao ? apuracao.totalVotos : 0
  const brancos = itens.find((i) => i.candidato === BRANCO)?.votos ?? 0

  /* ---- Resumo ---- */
  const resumo = [
    ['Eleição da CIPA 2026/2027'],
    [],
    ['Gerado em', geradoEm],
    ['Eleitores que votaram', lista.length],
  ]
  if (apuracao) resumo.push(['Votos registrados', total], ['Votos em branco', brancos])
  else resumo.push(['Apuração', 'ainda não liberada'])
  resumo.push([], ['O voto é secreto: a aba "Apuração" traz o total de cada candidato e a aba "Participação" traz quem votou, sem ligar uma coisa à outra.'])
  const wsResumo = XLSX.utils.aoa_to_sheet(resumo, { cellDates: true })
  if (wsResumo.B3) wsResumo.B3.z = FMT_DATA
  wsResumo['!cols'] = [{ wch: 26 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo')

  /* ---- Apuração (candidato e votos) ---- */
  if (apuracao) {
    const candidatos = itens.filter((i) => i.candidato !== BRANCO).sort((a, b) => b.votos - a.votos)
    const linhas = candidatos.map((i) => [
      1 + candidatos.filter((o) => o.votos > i.votos).length, // empate divide a posição
      i.candidato,
      i.funcao || '',
      i.votos,
      total ? i.votos / total : 0,
    ])
    linhas.push(['', 'VOTO EM BRANCO', '', brancos, total ? brancos / total : 0])
    const ws = XLSX.utils.aoa_to_sheet([['Posição', 'Candidato', 'Função', 'Votos', '% dos votos'], ...linhas])
    formatar(XLSX, ws, { E: '0.0%' })
    ws['!cols'] = [{ wch: 9 }, { wch: 40 }, { wch: 28 }, { wch: 9 }, { wch: 12 }]
    ws['!autofilter'] = { ref: ws['!ref'] }
    XLSX.utils.book_append_sheet(wb, ws, 'Apuração')
  }

  /* ---- Participação (quem votou e quando; sem a escolha) ---- */
  const part = lista.map((v) => [v.protocolo || '', v.nome || '', v.cargo || '', v.votadoEm ? new Date(v.votadoEm) : ''])
  const wsPart = XLSX.utils.aoa_to_sheet([['Protocolo', 'Nome', 'Cargo', 'Data e hora'], ...part], { cellDates: true })
  formatar(XLSX, wsPart, { D: FMT_DATA })
  wsPart['!cols'] = [{ wch: 16 }, { wch: 42 }, { wch: 32 }, { wch: 20 }]
  wsPart['!autofilter'] = { ref: wsPart['!ref'] }
  XLSX.utils.book_append_sheet(wb, wsPart, 'Participação')

  return wb
}

/** Gera e baixa o Excel. A biblioteca só é carregada quando alguém clica em "Baixar Excel". */
export async function baixarExcel(apuracao, votantes) {
  const mod = await import('xlsx')
  const XLSX = mod.utils ? mod : mod.default
  const wb = montarPlanilha(XLSX, apuracao, votantes)
  XLSX.writeFile(wb, nomeDoArquivo(), { cellDates: true })
}
