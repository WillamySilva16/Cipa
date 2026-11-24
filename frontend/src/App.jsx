import { useEffect, useMemo, useRef, useState } from 'react'
import { validarCpf, registrarVoto, apuracao, votantes as listarVotantes } from './api.js'
import { baixarExcel } from './exportar.js'
import { LOGO_RS, LOGO_RS_LARGURA, LOGO_RS_ALTURA } from './logo.js'

const BRANCO = 'VOTO EM BRANCO'
const SEGUNDOS_RESET = 60
const ESCALA_LOGO = 0.6

// RE (até 8 dígitos) aparece como foi digitado; a partir de 9 dígitos é CPF e ganha a máscara
const mascara = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length < 9) return d
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

const embaralha = (lista) => {
  const a = [...lista]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const normaliza = (s = '') =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

const iniciais = (nome = '') => {
  const p = nome.trim().split(/\s+/).filter(Boolean)
  if (!p.length) return '?'
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}

/* ---------- ícones ---------- */

const Icone = ({ children, ...props }) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {children}
  </svg>
)
const Seta = () => <Icone><path d="M12 4l-6 6 6 6" /></Icone>
const Check = () => <Icone><path d="M4 10.5l4 4 8-9" /></Icone>
const Cadeado = () => <Icone><rect x="4" y="9" width="12" height="8" rx="2" /><path d="M7 9V6.5a3 3 0 0 1 6 0V9" /></Icone>
const Fechar = () => <Icone><path d="M5 5l10 10M15 5L5 15" /></Icone>
const Imprimir = () => <Icone><path d="M6 8V3h8v5M6 14H4.5A1.5 1.5 0 0 1 3 12.5v-3A1.5 1.5 0 0 1 4.5 8h11A1.5 1.5 0 0 1 17 9.5v3a1.5 1.5 0 0 1-1.5 1.5H14" /><rect x="6" y="12" width="8" height="5" rx="1" /></Icone>
const Baixar = () => <Icone><path d="M10 3v9m0 0l-3.5-3.5M10 12l3.5-3.5M4 15v1.5h12V15" /></Icone>

const quando = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Sao_Paulo' }) : '—'

/* anéis vazados da marca RS, como na arte da campanha */
function Aneis() {
  const anel = (cx, cy) => (
    <g key={`${cx}-${cy}`} transform={`translate(${cx} ${cy}) rotate(-14)`}>
      <ellipse rx="66" ry="104" />
      <ellipse rx="49" ry="88" />
    </g>
  )
  return (
    <svg className="aneis" viewBox="0 0 440 400" aria-hidden="true">
      {[[330, 40], [392, 150], [310, 232], [396, 338]].map(([x, y]) => anel(x, y))}
    </svg>
  )
}

function Passos({ atual, onIdentificacao }) {
  const itens = ['Identificação', 'Voto', 'Concluído']
  return (
    <ol className="passos" aria-label="Etapas da votação">
      {itens.map((t, i) => {
        const estado = i < atual ? 'feito' : i === atual ? 'atual' : ''
        const miolo = (
          <>
            <span className="bola">{i < atual ? <Check /> : i + 1}</span>
            <span className="rot">{t}</span>
          </>
        )
        const volta = i === 0 && atual === 1 && onIdentificacao
        return (
          <li key={t} className={estado} aria-current={i === atual ? 'step' : undefined}>
            {volta ? (
              <button type="button" className="passo-link" onClick={onIdentificacao} title="Voltar para a identificação">
                {miolo}
              </button>
            ) : miolo}
          </li>
        )
      })}
    </ol>
  )
}

export default function App() {
  const [rota, setRota] = useState(window.location.hash)
  useEffect(() => {
    const f = () => setRota(window.location.hash)
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  const admin = rota === '#apuracao'
  return (
    <>
      <header className="topo">
        <Aneis />
        <div className="topo-in">
          <span
            className="logo-rs" role="img" aria-label="RS Terceirização"
            style={{
              '--logo': `url("${LOGO_RS}")`,
              width: Math.round(LOGO_RS_LARGURA * ESCALA_LOGO),
              height: Math.round(LOGO_RS_ALTURA * ESCALA_LOGO),
            }}
          >
            <img src={LOGO_RS} alt="" />
            <span className="logo-brilho" aria-hidden="true" />
          </span>
          <div className="topo-texto">
            <h1><span>Eleição da</span> CIPA 2026/2027</h1>
            <p>Comissão Interna de Prevenção de Acidentes e de Assédio</p>
            <span className="selo-secreto"><Cadeado /> Seu voto é secreto</span>
          </div>
        </div>
      </header>

      <main className="cartao">{admin ? <Apuracao /> : <Votacao />}</main>

      <footer className="rodape">
        <p className="tagline"><em>A gente faz</em><strong>por você</strong></p>
        {!admin && <a className="admin-link" href="#apuracao">Administração</a>}
      </footer>
    </>
  )
}

function Votacao() {
  const [etapa, setEtapa] = useState('cpf') // cpf | voto | fim
  const [cpf, setCpf] = useState('')
  const [dados, setDados] = useState(null)
  const [escolha, setEscolha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [busca, setBusca] = useState('')
  const [comprovante, setComprovante] = useState(null)
  const dlg = useRef(null)
  const limparAoVoltar = useRef(false)

  const candidatos = useMemo(() => (dados ? embaralha(dados.candidatos) : []), [dados])

  // a busca ignora acentos e maiúsculas; o candidato já marcado nunca some da lista
  const visiveis = useMemo(() => {
    const q = normaliza(busca)
    if (!q) return candidatos
    return candidatos.filter((c) => c.nome === escolha || normaliza(c.nome).includes(q))
  }, [candidatos, busca, escolha])

  // depois do voto a tela volta ao início sozinha, para o próximo eleitor
  useEffect(() => {
    if (etapa !== 'fim') return
    const t = setTimeout(() => window.location.reload(), SEGUNDOS_RESET * 1000)
    return () => clearTimeout(t)
  }, [etapa])

  // o botão "voltar" do celular/navegador volta uma etapa em vez de sair da página
  useEffect(() => {
    if (etapa !== 'voto') return
    const aoVoltar = () => irParaIdentificacao()
    window.addEventListener('popstate', aoVoltar)
    return () => window.removeEventListener('popstate', aoVoltar)
  }, [etapa])

  function irParaIdentificacao() {
    const limpar = limparAoVoltar.current
    limparAoVoltar.current = false
    setDados(null); setEscolha(''); setBusca(''); setErro('')
    if (limpar) setCpf('')
    setEtapa('cpf')
  }

  function voltar(limpar = false) {
    limparAoVoltar.current = limpar
    if (window.history.state?.etapa === 'voto') window.history.back()
    else irParaIdentificacao()
  }

  async function continuar(e) {
    e.preventDefault()
    setErro('')
    if (!cpf.replace(/\D/g, '')) return setErro('Digite seu CPF ou RE.')
    setCarregando(true)
    try {
      setDados(await validarCpf(cpf))
      window.history.pushState({ etapa: 'voto' }, '')
      setEtapa('voto')
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  async function confirmar() {
    dlg.current?.close()
    setErro('')
    setCarregando(true)
    try {
      setComprovante(await registrarVoto(cpf, escolha))
      window.history.replaceState({ etapa: 'fim' }, '')
      setEtapa('fim')
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  // clicar de novo no candidato já marcado tira a marcação
  const alternar = (nome) => setEscolha((atual) => (atual === nome ? '' : nome))

  const marcado = escolha === BRANCO
    ? { nome: 'Voto em branco', funcao: 'Nenhum candidato', iniciais: '—' }
    : candidatos.find((c) => c.nome === escolha)
      ? { ...candidatos.find((c) => c.nome === escolha), iniciais: iniciais(escolha) }
      : null

  if (etapa === 'fim')
    return (
      <div className="etapa">
        <Passos atual={3} />
        <section className="fim">
          <svg className="selo" viewBox="0 0 80 80" aria-hidden="true">
            <circle cx="40" cy="40" r="36" />
            <path d="M24 41l11 11 22-24" />
          </svg>
          <h2>Voto registrado!</h2>
          <p>Obrigado por participar da eleição da CIPA. Guarde seu comprovante.</p>

          {comprovante && (
            <article className="comprovante" aria-label="Comprovante de votação">
              <header>
                <strong>Comprovante de votação</strong>
                <span>Eleição da CIPA 2026/2027 · RS</span>
              </header>
              <dl>
                <div><dt>Protocolo</dt><dd className="protocolo">{comprovante.protocolo}</dd></div>
                <div><dt>Eleitor</dt><dd>{comprovante.nome}</dd></div>
                <div><dt>Cargo</dt><dd>{comprovante.cargo || '—'}</dd></div>
                <div><dt>Data e hora</dt><dd>{quando(comprovante.votadoEm)}</dd></div>
              </dl>
              <p className="comp-nota">
                Este comprovante confirma que você votou. Ele não mostra em quem você votou: o voto é secreto.
              </p>
            </article>
          )}

          <div className="fim-acoes">
            <button type="button" className="secundario" onClick={() => window.print()}>
              <Imprimir /> Imprimir ou salvar em PDF
            </button>
            <button type="button" className="primario" onClick={() => window.location.reload()}>Concluir</button>
          </div>
          <div className="reset" aria-hidden="true">
            <span style={{ animationDuration: `${SEGUNDOS_RESET}s` }} />
          </div>
          <small>Por segurança, esta tela volta ao início em {SEGUNDOS_RESET} segundos.</small>
        </section>
      </div>
    )

  if (etapa === 'voto')
    return (
      <div className="etapa votar">
        <Passos atual={1} onIdentificacao={() => voltar(false)} />
        <div className="cols">
          <div className="col-lista">
            <div className="eleitor">
              <span className="avatar" aria-hidden="true">{iniciais(dados.nome)}</span>
              <div className="eleitor-txt">
                <strong>{dados.nome}</strong>
                <span>{dados.cargo}</span>
              </div>
              <button type="button" className="link" onClick={() => voltar(true)} disabled={carregando}>Não sou eu</button>
            </div>

            <fieldset className="cedula" disabled={carregando}>
              <legend>
                <h2>Escolha um candidato</h2>
                <p>Toque em um nome para marcar. Toque de novo para desmarcar.</p>
              </legend>

              {candidatos.length > 5 && (
                <div className="busca">
                  <input
                    type="search" value={busca} autoComplete="off"
                    placeholder="Buscar candidato pelo nome" aria-label="Buscar candidato pelo nome"
                    onChange={(e) => setBusca(e.target.value)}
                  />
                  {busca && (
                    <button type="button" className="limpar" onClick={() => setBusca('')} aria-label="Limpar busca"><Fechar /></button>
                  )}
                </div>
              )}
              {busca && (
                <p className="contagem" aria-live="polite">
                  {visiveis.length === 0
                    ? <>Nenhum candidato encontrado para “{busca}”. <button type="button" className="link" onClick={() => setBusca('')}>Limpar busca</button></>
                    : `Mostrando ${visiveis.length} de ${candidatos.length} candidatos`}
                </p>
              )}

              <div className="grade">
                {visiveis.map((c, i) => (
                  <label key={c.nome} className="cand" style={{ '--i': Math.min(i, 14) }}>
                    <input
                      type="radio" name="cand" checked={escolha === c.nome}
                      onChange={() => {}} onClick={() => alternar(c.nome)}
                    />
                    <span className="cand-topo">
                      <span className="mini" aria-hidden="true">{iniciais(c.nome)}</span>
                      <span className="caixa" aria-hidden="true"><Check /></span>
                    </span>
                    <span className="info">
                      <b>{c.nome}</b>
                      {c.funcao && <small>{c.funcao}</small>}
                    </span>
                  </label>
                ))}
              </div>

              <label className="cand branco">
                <input
                  type="radio" name="cand" checked={escolha === BRANCO}
                  onChange={() => {}} onClick={() => alternar(BRANCO)}
                />
                <span className="caixa" aria-hidden="true"><Check /></span>
                <span className="info">
                  <b>Voto em branco</b>
                  <small>Não escolher nenhum candidato</small>
                </span>
              </label>
            </fieldset>
          </div>

          <aside className="resumo" aria-label="Resumo do voto">
            <div className="resumo-card">
              <p className="resumo-tit">Seu voto</p>
              {marcado ? (
                <div className="resumo-escolha">
                  <span className="mini grande" aria-hidden="true">{marcado.iniciais}</span>
                  <div className="resumo-nome">
                    <b>{marcado.nome}</b>
                    {marcado.funcao && <small>{marcado.funcao}</small>}
                  </div>
                  <button type="button" className="limpar-escolha" onClick={() => setEscolha('')} disabled={carregando}>
                    <Fechar /> Limpar
                  </button>
                </div>
              ) : (
                <p className="resumo-vazio">Nenhum candidato marcado.</p>
              )}

              {erro && <p className="msg erro" role="alert">{erro}</p>}

              <div className="resumo-acoes">
                <button type="button" className="secundario voltar-btn" onClick={() => voltar(false)} disabled={carregando}>
                  <Seta /> Voltar
                </button>
                <button type="button" className="primario" disabled={!escolha || carregando} onClick={() => dlg.current?.showModal()}>
                  {carregando && <span className="giro" aria-hidden="true" />}
                  {carregando ? 'Registrando…' : 'Confirmar voto'}
                </button>
              </div>
              <p className="resumo-nota">Você ainda poderá revisar antes de confirmar.</p>
            </div>
          </aside>
        </div>

        <dialog ref={dlg} className="modal" onClick={(e) => e.target === dlg.current && dlg.current.close()}>
          <h3>Confirmar seu voto?</h3>
          <div className="modal-escolha">
            <span className="mini grande" aria-hidden="true">{marcado?.iniciais}</span>
            <div>
              <b>{marcado?.nome}</b>
              {marcado?.funcao && <small>{marcado.funcao}</small>}
            </div>
          </div>
          <p>Depois de confirmar, não é possível alterar.</p>
          <div className="modal-acoes">
            <button type="button" className="secundario" onClick={() => dlg.current?.close()}>Revisar</button>
            <button type="button" className="primario" onClick={confirmar}>Confirmar</button>
          </div>
        </dialog>
      </div>
    )

  const digitos = cpf.replace(/\D/g, '')
  const tipo = digitos ? (digitos.length >= 9 ? 'CPF' : 'RE') : ''

  return (
    <div className="etapa ident">
      <Passos atual={0} />
      <form onSubmit={continuar} noValidate>
        <h2 className="titulo">Informe seu CPF ou RE</h2>
        <p className="apoio">
          Usamos o CPF ou o RE só para liberar o voto e garantir que cada pessoa vote uma vez. Ele não fica ligado à sua escolha.
        </p>
        <label className="campo" htmlFor="cpf">CPF ou RE</label>
        <div className="campo-id">
          <input
            id="cpf" type="text" inputMode="numeric" autoComplete="off" autoFocus
            placeholder="Digite aqui" value={cpf} aria-invalid={!!erro}
            onChange={(e) => { setCpf(mascara(e.target.value)); if (erro) setErro('') }}
          />
          {tipo && <span className="tipo" aria-hidden="true">{tipo}</span>}
        </div>
        {erro && <p className="msg erro" role="alert">{erro}</p>}
        <div className="acoes">
          <button className="primario" disabled={carregando}>
            {carregando && <span className="giro" aria-hidden="true" />}
            {carregando ? 'Validando…' : 'Continuar'}
          </button>
        </div>
        <ul className="garantias">
          <li><Cadeado /> Voto secreto</li>
          <li><Check /> Um voto por pessoa</li>
        </ul>
      </form>
    </div>
  )
}

function Apuracao() {
  const [token, setToken] = useState('')
  const [res, setRes] = useState(null)         // placar (pode estar bloqueado até o encerramento)
  const [lista, setLista] = useState(null)     // quem votou
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState('resultado')
  const [filtro, setFiltro] = useState('')
  const [buscaPessoa, setBuscaPessoa] = useState('')
  const [limite, setLimite] = useState(50)
  const [atualizado, setAtualizado] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [baixando, setBaixando] = useState(false)
  const [auto, setAuto] = useState(true)           // atualiza sozinho para acompanhar quem está votando
  const [novos, setNovos] = useState(() => new Set())
  const vistos = useRef(null)

  async function carregar(e, silencioso = false) {
    e?.preventDefault()
    if (!silencioso) { setErro(''); setCarregando(true) }
    const [placar, quem] = await Promise.allSettled([apuracao(token), listarVotantes(token)])
    if (quem.status === 'rejected') {
      setRes(null); setLista(null); setErro(quem.reason.message)
    } else {
      // quem acabou de votar fica destacado por alguns segundos
      const atuais = new Set(quem.value.map((v) => v.protocolo))
      if (vistos.current) {
        const recentes = quem.value.filter((v) => !vistos.current.has(v.protocolo)).map((v) => v.protocolo)
        if (recentes.length) {
          setNovos(new Set(recentes))
          setTimeout(() => setNovos(new Set()), 8000)
        }
      }
      vistos.current = atuais
      setLista(quem.value)
      if (placar.status === 'fulfilled') { setRes(placar.value); setAviso('') }
      else { setRes(null); setAviso(placar.reason.message) }
      setAtualizado(new Date())
    }
    if (!silencioso) setCarregando(false)
  }

  useEffect(() => {
    if (!auto || lista === null) return
    const t = setInterval(() => carregar(undefined, true), 20000)
    return () => clearInterval(t)
  }, [auto, lista === null, token])

  async function exportar() {
    setErro('')
    setBaixando(true)
    try {
      await baixarExcel(res, lista)
    } catch {
      setErro('Não foi possível gerar o Excel. Tente de novo.')
    } finally {
      setBaixando(false)
    }
  }

  const maximo = res ? Math.max(1, ...res.itens.map((i) => i.votos)) : 1
  const pct = (v) => (res && res.totalVotos ? Math.round((v / res.totalVotos) * 100) : 0)
  const itens = res
    ? res.itens.filter((i) => normaliza(i.candidato === BRANCO ? 'voto em branco' : i.candidato).includes(normaliza(filtro)))
    : []
  const q = normaliza(buscaPessoa)
  const pessoas = lista
    ? [...lista].reverse().filter((v) => !q || normaliza(`${v.nome || ''} ${v.cargo || ''} ${v.protocolo || ''}`).includes(q))
    : []
  const carregado = lista !== null

  return (
    <div className="etapa admin">
      <a className="voltar" href="#"><Seta /> Voltar para a votação</a>
      <h2 className="titulo">Administração da eleição</h2>
      <p className="apoio">Acompanhe os votos por candidato e quem já votou. Só quem tem o token de administração vê esta tela.</p>

      <form className="form-admin" onSubmit={carregar}>
        <div className="form-admin-campo">
          <label className="campo" htmlFor="tk">Token de administração</label>
          <input id="tk" type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
        </div>
        <button className="primario" disabled={carregando || !token}>
          {carregando && <span className="giro" aria-hidden="true" />}
          {carregando ? 'Carregando…' : carregado ? 'Atualizar' : 'Entrar'}
        </button>
      </form>
      {erro && <p className="msg erro" role="alert">{erro}</p>}

      {carregado && (
        <section className="resultado">
          <div className="resultado-barra">
            <div className="abas" role="tablist" aria-label="Seções da administração">
              <button type="button" role="tab" aria-selected={aba === 'resultado'} className={aba === 'resultado' ? 'ativa' : ''} onClick={() => setAba('resultado')}>
                Resultado
              </button>
              <button type="button" role="tab" aria-selected={aba === 'quem'} className={aba === 'quem' ? 'ativa' : ''} onClick={() => setAba('quem')}>
                Quem votou <span className="contador">{lista.length}</span>
              </button>
            </div>
            <button type="button" className="secundario baixar" onClick={exportar} disabled={baixando}>
              <Baixar /> {baixando ? 'Gerando…' : 'Baixar Excel'}
            </button>
          </div>
          <div className="atualiza">
            {atualizado && (
              <p className="atualizado">
                Atualizado às {atualizado.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            )}
            <label className="auto">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              Atualizar sozinho a cada 20 s
            </label>
          </div>

          {aba === 'resultado' && (
            <div role="tabpanel">
              {aviso && <p className="aviso">{aviso}</p>}
              {res && (
                <>
                  <div className="stats">
                    <div className="stat"><span>Votos registrados</span><strong>{res.totalVotos}</strong></div>
                    <div className="stat"><span>Eleitores que votaram</span><strong>{res.totalVotantes}</strong></div>
                  </div>
                  <div className="busca">
                    <input
                      type="search" value={filtro} autoComplete="off"
                      placeholder="Filtrar por nome" aria-label="Filtrar candidatos por nome"
                      onChange={(e) => setFiltro(e.target.value)}
                    />
                    {filtro && (
                      <button type="button" className="limpar" onClick={() => setFiltro('')} aria-label="Limpar filtro"><Fechar /></button>
                    )}
                  </div>
                  {itens.length === 0 && <p className="contagem">Nenhum candidato encontrado para “{filtro}”.</p>}
                  <ul className="ranking">
                    {itens.map((i) => (
                      <li key={i.candidato} className={i.votos === maximo && i.votos > 0 ? 'lider' : ''}>
                        <div className="linha">
                          <span>{i.candidato === BRANCO ? 'Voto em branco' : i.candidato}</span>
                          <b>{i.votos} <small>({pct(i.votos)}%)</small></b>
                        </div>
                        <div className="barra"><span style={{ width: `${(i.votos / maximo) * 100}%` }} /></div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {aba === 'quem' && (
            <div role="tabpanel">
              <p className="nota-sigilo">
                <Cadeado />
                <span>
                  O voto é secreto. O sistema guarda <b>quem votou</b> e <b>quantos votos cada candidato recebeu</b>, mas não liga uma coisa à outra.
                  Para conferir um comprovante, busque pelo protocolo.
                </span>
              </p>
              <div className="busca">
                <input
                  type="search" value={buscaPessoa} autoComplete="off"
                  placeholder="Buscar por nome, cargo ou protocolo" aria-label="Buscar eleitor"
                  onChange={(e) => { setBuscaPessoa(e.target.value); setLimite(50) }}
                />
                {buscaPessoa && (
                  <button type="button" className="limpar" onClick={() => setBuscaPessoa('')} aria-label="Limpar busca"><Fechar /></button>
                )}
              </div>
              {lista.length === 0 && <p className="contagem">Ninguém votou ainda.</p>}
              {lista.length > 0 && pessoas.length === 0 && <p className="contagem">Nenhum eleitor encontrado para “{buscaPessoa}”.</p>}
              <ul className="votantes">
                {pessoas.slice(0, limite).map((v, i) => (
                  <li key={v.protocolo || i} className={novos.has(v.protocolo) ? 'novo' : ''}>
                    <div className="votante-nome">
                      <b>{v.nome || 'Sem nome registrado'}</b>
                      <small>{v.cargo || '—'}</small>
                    </div>
                    <div className="votante-info">
                      <span className="protocolo-mini">{v.protocolo || '—'}</span>
                      <small>{quando(v.votadoEm)}</small>
                    </div>
                  </li>
                ))}
              </ul>
              {pessoas.length > limite && (
                <button type="button" className="secundario" onClick={() => setLimite((l) => l + 50)}>
                  Mostrar mais ({pessoas.length - limite})
                </button>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
