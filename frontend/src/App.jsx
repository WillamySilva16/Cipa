import { useEffect, useMemo, useRef, useState } from 'react'
import { validarCpf, registrarVoto, apuracao } from './api.js'
import { LOGO_RS, LOGO_RS_LARGURA, LOGO_RS_ALTURA } from './logo.js'

const BRANCO = 'VOTO EM BRANCO'
const SEGUNDOS_RESET = 6
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
      await registrarVoto(cpf, escolha)
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
          <p>Obrigado por participar da eleição da CIPA. Você já pode fechar esta página.</p>
          <div className="reset" aria-hidden="true">
            <span style={{ animationDuration: `${SEGUNDOS_RESET}s` }} />
          </div>
          <small>A tela volta ao início em {SEGUNDOS_RESET} segundos.</small>
          <button type="button" className="link" onClick={() => window.location.reload()}>Voltar ao início agora</button>
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
  const [res, setRes] = useState(null)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('')
  const [atualizado, setAtualizado] = useState(null)
  const [carregando, setCarregando] = useState(false)

  async function carregar(e) {
    e?.preventDefault()
    setErro('')
    setCarregando(true)
    try {
      setRes(await apuracao(token))
      setAtualizado(new Date())
    } catch (err) {
      setRes(null); setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  const maximo = res ? Math.max(1, ...res.itens.map((i) => i.votos)) : 1
  const pct = (v) => (res && res.totalVotos ? Math.round((v / res.totalVotos) * 100) : 0)
  const itens = res
    ? res.itens.filter((i) => normaliza(i.candidato === BRANCO ? 'voto em branco' : i.candidato).includes(normaliza(filtro)))
    : []

  return (
    <div className="etapa admin">
      <a className="voltar" href="#"><Seta /> Voltar para a votação</a>
      <h2 className="titulo">Apuração</h2>
      <p className="apoio">Acompanhe os votos por candidato. Só quem tem o token de administração vê esta tela.</p>

      <form className="form-admin" onSubmit={carregar}>
        <div className="form-admin-campo">
          <label className="campo" htmlFor="tk">Token de administração</label>
          <input id="tk" type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
        </div>
        <button className="primario" disabled={carregando || !token}>
          {carregando && <span className="giro" aria-hidden="true" />}
          {carregando ? 'Apurando…' : 'Apurar'}
        </button>
      </form>
      {erro && <p className="msg erro" role="alert">{erro}</p>}

      {res && (
        <section className="resultado">
          <div className="stats">
            <div className="stat"><span>Votos registrados</span><strong>{res.totalVotos}</strong></div>
            <div className="stat"><span>Eleitores que votaram</span><strong>{res.totalVotantes}</strong></div>
          </div>
          <div className="resultado-topo">
            {atualizado && (
              <p className="atualizado">
                Atualizado às {atualizado.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            )}
            <button type="button" className="link" onClick={carregar} disabled={carregando}>Atualizar</button>
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
        </section>
      )}
    </div>
  )
}
