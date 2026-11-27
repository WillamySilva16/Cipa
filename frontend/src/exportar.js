// Excel da apuração: resumo, total de votos por candidato, lista de quem votou, participação por hora e por IP.
// O voto é secreto: a apuração (candidato e votos) e a participação (quem votou) ficam em abas separadas,
// e nada nesta planilha liga uma pessoa à sua escolha.

const BRANCO = 'VOTO EM BRANCO'
const ZONA = 'America/Sao_Paulo'

const COR = {
  navy: 'FF09214A', azul: 'FF1551C6', claro: 'FFE8EEFB', destaque: 'FFD3E1FB',
  zebra: 'FFF6F9FF', linha: 'FFDDE3EE', texto: 'FF0F1C36', suave: 'FF56637D', branco: 'FFFFFFFF', subtitulo: 'FFC9D8F5',
}

const pad = (n) => String(n).padStart(2, '0')

/* ---------- datas: o Excel guarda o horário de parede, então convertemos para o horário de São Paulo ---------- */

const fmtPartes = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

function partes(data) {
  const o = {}
  for (const p of fmtPartes.formatToParts(data)) o[p.type] = p.value
  return { a: +o.year, m: +o.month, d: +o.day, h: +o.hour, mi: +o.minute, s: +o.second }
}

const relogio = (data) => {
  const p = partes(data)
  return new Date(Date.UTC(p.a, p.m - 1, p.d, p.h, p.mi, p.s))
}

export function nomeDoArquivo(agora = new Date()) {
  const p = partes(agora)
  return `apuracao-cipa-2026-2027_${p.a}-${pad(p.m)}-${pad(p.d)}_${pad(p.h)}${pad(p.mi)}.xlsx`
}

/* ---------- estilos ---------- */

const preenche = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
const filete = { bottom: { style: 'thin', color: { argb: COR.linha } } }

function cabecalho(ws, esquerda = []) {
  const linha = ws.getRow(1)
  linha.height = 28
  linha.eachCell((c, col) => {
    c.font = { name: 'Calibri', bold: true, size: 11, color: { argb: COR.branco } }
    c.fill = preenche(COR.navy)
    c.alignment = { vertical: 'middle', horizontal: esquerda.includes(col) ? 'left' : 'center', indent: esquerda.includes(col) ? 1 : 0 }
    c.border = { bottom: { style: 'medium', color: { argb: COR.azul } } }
  })
  ws.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }]
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } }
}

function corpo(ws, esquerda = []) {
  ws.eachRow((linha, n) => {
    if (n === 1) return
    linha.height = 21
    linha.eachCell((c, col) => {
      c.font = { name: 'Calibri', size: 11, color: { argb: COR.texto }, ...(c.font || {}) }
      c.alignment = { vertical: 'middle', horizontal: esquerda.includes(col) ? 'left' : 'center', indent: esquerda.includes(col) ? 1 : 0 }
      c.border = filete
      if (n % 2 === 1) c.fill = preenche(COR.zebra)
    })
  })
}

function impressao(ws, retrato = true) {
  ws.pageSetup = { orientation: retrato ? 'portrait' : 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1', paperSize: 9 }
}

/* ---------- montagem ---------- */

export function montarPlanilha(ExcelJS, apuracao, votantes, geradoEm = new Date()) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Portal de votação da CIPA'
  wb.created = new Date()
  const lista = votantes || []
  const itens = apuracao ? apuracao.itens : []
  const total = apuracao ? apuracao.totalVotos : 0
  const brancos = itens.find((i) => i.candidato === BRANCO)?.votos ?? 0
  const candidatos = itens.filter((i) => i.candidato !== BRANCO).sort((a, b) => b.votos - a.votos)
  const maximo = candidatos.length ? candidatos[0].votos : 0
  const lideres = maximo > 0 ? candidatos.filter((c) => c.votos === maximo) : []

  /* ===== Resumo ===== */
  const r = wb.addWorksheet('Resumo', { views: [{ showGridLines: false }] })
  r.columns = [{ width: 32 }, { width: 46 }, { width: 8 }]
  r.mergeCells('A1:C1')
  r.getCell('A1').value = 'Eleição da CIPA 2026/2027'
  r.getCell('A1').font = { name: 'Calibri', bold: true, size: 20, color: { argb: COR.branco } }
  r.getCell('A1').alignment = { vertical: 'middle', indent: 1 }
  r.getRow(1).height = 40
  r.mergeCells('A2:C2')
  r.getCell('A2').value = 'Comissão Interna de Prevenção de Acidentes e de Assédio · RS'
  r.getCell('A2').font = { name: 'Calibri', size: 11, color: { argb: COR.subtitulo } }
  r.getCell('A2').alignment = { vertical: 'middle', indent: 1 }
  r.getRow(2).height = 26
  for (const c of ['A1', 'B1', 'C1', 'A2', 'B2', 'C2']) r.getCell(c).fill = preenche(COR.navy)
  r.getRow(3).height = 12

  const kpis = [['Gerado em', relogio(geradoEm), 'dd/mm/yyyy hh:mm'], ['Eleitores que votaram', lista.length, '0']]
  if (apuracao) {
    kpis.push(['Votos registrados', total, '0'], ['Votos em branco', brancos, '0'])
    kpis.push(['Candidato mais votado',
      lideres.length === 0 ? 'Ainda sem votos'
        : lideres.length === 1 ? `${lideres[0].candidato} (${maximo} voto${maximo > 1 ? 's' : ''})`
          : `Empate: ${lideres.map((l) => l.candidato).join(' e ')} (${maximo} cada)`, '@'])
  } else {
    kpis.push(['Apuração', 'ainda não liberada', '@'])
  }
  if (lista.length) {
    kpis.push(['Primeiro voto', relogio(new Date(lista[0].votadoEm)), 'dd/mm/yyyy hh:mm'])
    kpis.push(['Último voto', relogio(new Date(lista[lista.length - 1].votadoEm)), 'dd/mm/yyyy hh:mm'])
  }
  kpis.forEach(([rotulo, valor, fmt], i) => {
    const linha = r.getRow(4 + i)
    linha.height = 30
    const a = linha.getCell(1); const b = linha.getCell(2)
    a.value = rotulo; b.value = valor; b.numFmt = fmt
    a.font = { name: 'Calibri', size: 11, color: { argb: COR.suave } }
    b.font = { name: 'Calibri', size: 13, bold: true, color: { argb: COR.azul } }
    for (const c of [a, b]) { c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true }; c.border = filete }
  })
  const fimKpi = 4 + kpis.length
  r.getRow(fimKpi).height = 14
  r.mergeCells(`A${fimKpi + 1}:C${fimKpi + 1}`)
  const nota = r.getCell(`A${fimKpi + 1}`)
  nota.value = 'O voto é secreto. A aba "Apuração" traz o total de votos de cada candidato e a aba "Participação" traz quem votou e quando, sem ligar uma coisa à outra.'
  nota.font = { name: 'Calibri', italic: true, size: 10.5, color: { argb: COR.suave } }
  nota.alignment = { wrapText: true, vertical: 'top', indent: 1 }
  nota.fill = preenche(COR.claro)
  r.getRow(fimKpi + 1).height = 44
  impressao(r)

  /* ===== Apuração (tabela limpa, boa para importar em outros sistemas) ===== */
  if (apuracao) {
    const ws = wb.addWorksheet('Apuração')
    ws.columns = [
      { header: 'Posição', key: 'pos', width: 10 }, { header: 'Candidato', key: 'nome', width: 42 },
      { header: 'Função', key: 'funcao', width: 30 }, { header: 'Votos', key: 'votos', width: 10 },
      { header: '% dos votos', key: 'pct', width: 13 },
    ]
    candidatos.forEach((c) => {
      const pos = c.votos > 0 ? `${1 + candidatos.filter((o) => o.votos > c.votos).length}º` : '—' // empate divide a posição
      ws.addRow({ pos, nome: c.candidato, funcao: c.funcao || '', votos: c.votos, pct: total ? c.votos / total : 0 })
    })
    ws.addRow({ pos: '—', nome: 'VOTO EM BRANCO', funcao: '', votos: brancos, pct: total ? brancos / total : 0 })
    cabecalho(ws, [2, 3])
    corpo(ws, [2, 3])
    ws.eachRow((linha, n) => {
      if (n === 1) return
      linha.getCell(4).numFmt = '0'
      linha.getCell(5).numFmt = '0.0%'
      const ehBranco = linha.getCell(2).value === 'VOTO EM BRANCO'
      const lider = !ehBranco && linha.getCell(1).value === '1º'
      linha.eachCell((c) => {
        if (lider) { c.fill = preenche(COR.destaque); c.font = { ...c.font, bold: true } }
        if (ehBranco) c.font = { ...c.font, italic: true, color: { argb: COR.suave } }
      })
    })
    impressao(ws)
  }

  /* ===== Participação (quem votou e quando; sem a escolha) ===== */
  const wp = wb.addWorksheet('Participação')
  wp.columns = [
    { header: 'Nº', key: 'n', width: 7 }, { header: 'Protocolo', key: 'protocolo', width: 18 },
    { header: 'Nome', key: 'nome', width: 44 }, { header: 'Cargo', key: 'cargo', width: 34 },
    { header: 'IP', key: 'ip', width: 20 },
    { header: 'Data', key: 'data', width: 13 }, { header: 'Hora', key: 'hora', width: 11 },
  ]
  const porHora = new Map()
  lista.forEach((v, i) => {
    const p = partes(new Date(v.votadoEm))
    const chave = `${p.a}-${pad(p.m)}-${pad(p.d)} ${pad(p.h)}`
    porHora.set(chave, (porHora.get(chave) || 0) + 1)
    wp.addRow({
      n: i + 1, protocolo: v.protocolo || '', nome: v.nome || '', cargo: v.cargo || '', ip: v.ip || '',
      data: new Date(Date.UTC(p.a, p.m - 1, p.d)), hora: (p.h * 3600 + p.mi * 60 + p.s) / 86400,
    })
  })
  cabecalho(wp, [3, 4, 5])
  corpo(wp, [3, 4, 5])
  wp.eachRow((linha, n) => {
    if (n === 1) return
    linha.getCell(6).numFmt = 'dd/mm/yyyy'
    linha.getCell(7).numFmt = 'hh:mm:ss'
    linha.getCell(2).font = { name: 'Consolas', size: 10.5, bold: true, color: { argb: COR.azul } }
  })
  impressao(wp, false)

  /* ===== Participação por hora (para acompanhar a adesão ao longo do dia) ===== */
  const wh = wb.addWorksheet('Por hora')
  wh.columns = [
    { header: 'Data', key: 'data', width: 13 }, { header: 'Faixa horária', key: 'faixa', width: 18 },
    { header: 'Votantes', key: 'qtd', width: 12 }, { header: 'Acumulado', key: 'acum', width: 13 },
  ]
  let acumulado = 0
  for (const [chave, qtd] of [...porHora.entries()].sort()) {
    const [dia, h] = chave.split(' ')
    const [a, m, d] = dia.split('-').map(Number)
    acumulado += qtd
    wh.addRow({ data: new Date(Date.UTC(a, m - 1, d)), faixa: `${h}:00 – ${h}:59`, qtd, acum: acumulado })
  }
  cabecalho(wh)
  corpo(wh)
  wh.eachRow((linha, n) => { if (n > 1) linha.getCell(1).numFmt = 'dd/mm/yyyy' })
  impressao(wh)

  /* ===== Por IP (de onde vieram os votos; só quem votou, nunca em quem) ===== */
  const wi = wb.addWorksheet('Por IP')
  wi.columns = [
    { header: 'IP', key: 'ip', width: 22 }, { header: 'Votos', key: 'qtd', width: 10 },
    { header: 'Primeiro voto', key: 'primeiro', width: 19 }, { header: 'Último voto', key: 'ultimo', width: 19 },
    { header: 'Eleitores', key: 'nomes', width: 80 },
  ]
  const porIp = new Map()
  for (const v of lista) {
    const chave = v.ip || 'Sem IP registrado'
    const g = porIp.get(chave) || { ip: chave, datas: [], nomes: [] }
    g.datas.push(new Date(v.votadoEm)); g.nomes.push(v.nome || '')
    porIp.set(chave, g)
  }
  ;[...porIp.values()].sort((a, b) => b.nomes.length - a.nomes.length || a.ip.localeCompare(b.ip)).forEach((g) => {
    wi.addRow({
      ip: g.ip, qtd: g.nomes.length,
      primeiro: relogio(new Date(Math.min(...g.datas))), ultimo: relogio(new Date(Math.max(...g.datas))),
      nomes: g.nomes.join('; '),
    })
  })
  cabecalho(wi, [1, 5])
  corpo(wi, [1, 5])
  wi.eachRow((linha, n) => {
    if (n === 1) return
    linha.getCell(3).numFmt = 'dd/mm/yyyy hh:mm:ss'
    linha.getCell(4).numFmt = 'dd/mm/yyyy hh:mm:ss'
    linha.getCell(5).alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true }
    linha.getCell(1).font = { name: 'Consolas', size: 10.5, bold: true, color: { argb: COR.azul } }
    linha.height = Math.max(21, 15 * Math.ceil(String(linha.getCell(5).value || '').length / 85))
  })
  impressao(wi, false)

  return wb
}

/** Gera e baixa o Excel. A biblioteca só é carregada quando alguém clica em "Baixar Excel". */
export async function baixarExcel(apuracao, votantes) {
  const mod = await import('exceljs')
  const ExcelJS = mod.default ?? mod
  const wb = montarPlanilha(ExcelJS, apuracao, votantes)
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeDoArquivo()
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
