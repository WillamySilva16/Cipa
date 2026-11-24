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

function Passos({ atual }) {
  const itens = ['Identificação', 'Voto', 'Concluído']
  return (
    <ol className="passos" aria-label="Etapas da votação">
      {itens.map((t, i) => (
        <li key={t} className={i < atual ? 'feito' : i === atual ? 'atual' : ''} aria-current={i === atual ? 'step' : undefined}>
          <span className="bola">{i < atual ? '✓' : i + 1}</span>
          <span className="rot">{t}</span>
        </li>
      ))}
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
  return (
    <>
      <header className="topo">
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
          <div>
            <h1>Eleição da CIPA</h1>
            <p>Seu voto é secreto.</p>
          </div>
        </div>
      </header>
      <main className="cartao">{rota === '#apuracao' ? <Apuracao /> : <Votacao />}</main>
      {rota !== '#apuracao' && (
        <footer className="rodape">
          <a href="#apuracao">Administração</a>
        </footer>
      )}
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

  async function continuar(e) {
    e.preventDefault()
    setErro('')
    if (!cpf.replace(/\D/g, '')) return setErro('Digite seu CPF ou RE.')
    setCarregando(true)
    try {
      setDados(await validarCpf(cpf))
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
      setEtapa('fim')
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  function voltar() {
    setCpf(''); setDados(null); setEscolha(''); setBusca(''); setErro(''); setEtapa('cpf')
  }

  const rotuloEscolha = escolha === BRANCO ? 'voto em branco' : escolha

  if (etapa === 'fim')
    return (
      <div className="etapa">
        <Passos atual={3} />
        <section className="fim">
          <svg className="selo" viewBox="0 0 80 80" aria-hidden="true">
            <circle cx="40" cy="40" r="36" />
            <path d="M24 41l11 11 22-24" />
          </svg>
          <h2>Voto registrado</h2>
          <p>Obrigado por participar da eleição da CIPA. Você já pode fechar esta página.</p>
          <div className="reset" aria-hidden="true">
            <span style={{ animationDuration: `${SEGUNDOS_RESET}s` }} />
          </div>
          <small>A tela volta ao início em {SEGUNDOS_RESET} segundos.</small>
        </section>
      </div>
    )

  if (etapa === 'voto')
    return (
      <div className="etapa">
        <Passos atual={1} />
        <div className="eleitor">
          <span className="avatar" aria-hidden="true">{iniciais(dados.nome)}</span>
          <div className="eleitor-txt">
            <strong>{dados.nome}</strong>
            <span>{dados.cargo}</span>
          </div>
          <button type="button" className="link" onClick={voltar} disabled={carregando}>Não sou eu</button>
        </div>

        <fieldset className="cedula" disabled={carregando}>
          <legend>
            <h2>Escolha um candidato</h2>
            <p>Marque uma opção. Você vota uma única vez.</p>
          </legend>

          {candidatos.length > 5 && (
            <div className="busca">
              <input
                type="search" value={busca} autoComplete="off"
                placeholder="Buscar candidato pelo nome" aria-label="Buscar candidato pelo nome"
                onChange={(e) => setBusca(e.target.value)}
              />
              {busca && (
                <button type="button" className="limpar" onClick={() => setBusca('')} aria-label="Limpar busca">×</button>
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
                <input type="radio" name="cand" checked={escolha === c.nome} onChange={() => setEscolha(c.nome)} />
                <span className="cand-topo">
                  <span className="mini" aria-hidden="true">{iniciais(c.nome)}</span>
                  <span className="caixa" aria-hidden="true">
                    <svg viewBox="0 0 20 20"><path d="M4 10.5l4 4 8-9" /></svg>
                  </span>
                </span>
                <span className="info">
                  <b>{c.nome}</b>
                  {c.funcao && <small>{c.funcao}</small>}
                </span>
              </label>
            ))}
          </div>

          <label className="cand branco">
            <input type="radio" name="cand" checked={escolha === BRANCO} onChange={() => setEscolha(BRANCO)} />
            <span className="caixa" aria-hidden="true">
              <svg viewBox="0 0 20 20"><path d="M4 10.5l4 4 8-9" /></svg>
            </span>
            <span className="info"><b>Voto em branco</b></span>
          </label>
        </fieldset>

        {erro && <p className="msg erro" role="alert">{erro}</p>}

        <div className="acoes fixa">
          {escolha && (
            <p className="marcado">
              Você marcou: <strong>{rotuloEscolha}</strong>
            </p>
          )}
          <button type="button" className="primario" disabled={!escolha || carregando} onClick={() => dlg.current?.showModal()}>
            {carregando && <span className="giro" aria-hidden="true" />}
            {carregando ? 'Registrando…' : 'Confirmar voto'}
          </button>
        </div>

        <dialog ref={dlg} className="modal" onClick={(e) => e.target === dlg.current && dlg.current.close()}>
          <h3>Confirmar seu voto?</h3>
          <p>
            Você vai votar em <strong>{rotuloEscolha}</strong>. Depois de confirmar, não é possível alterar.
          </p>
          <div className="modal-acoes">
            <button type="button" className="secundario" onClick={() => dlg.current?.close()}>Revisar</button>
            <button type="button" className="primario" onClick={confirmar}>Confirmar</button>
          </div>
        </dialog>
      </div>
    )

  return (
    <div className="etapa">
      <Passos atual={0} />
      <form onSubmit={continuar} noValidate>
        <h2 className="titulo">Informe seu CPF ou RE</h2>
        <p className="apoio">
          Usamos o CPF ou o RE só para liberar o voto e garantir que cada pessoa vote uma vez. Ele não fica ligado à sua escolha.
        </p>
        <label className="campo" htmlFor="cpf">CPF ou RE</label>
        <input
          id="cpf" type="text" inputMode="numeric" autoComplete="off" autoFocus
          placeholder="CPF ou RE" value={cpf} aria-invalid={!!erro}
          onChange={(e) => { setCpf(mascara(e.target.value)); if (erro) setErro('') }}
        />
        {erro && <p className="msg erro" role="alert">{erro}</p>}
        <div className="acoes">
          <button className="primario" disabled={carregando}>
            {carregando && <span className="giro" aria-hidden="true" />}
            {carregando ? 'Validando…' : 'Continuar'}
          </button>
        </div>
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

  async function carregar(e) {
    e?.preventDefault()
    setErro('')
    try {
      setRes(await apuracao(token))
      setAtualizado(new Date())
    } catch (err) {
      setRes(null); setErro(err.message)
    }
  }

  const maximo = res ? Math.max(1, ...res.itens.map((i) => i.votos)) : 1
  const pct = (v) => (res && res.totalVotos ? Math.round((v / res.totalVotos) * 100) : 0)
  const itens = res
    ? res.itens.filter((i) => normaliza(i.candidato === BRANCO ? 'voto em branco' : i.candidato).includes(normaliza(filtro)))
    : []

  return (
    <>
      <a className="voltar" href="#">← Voltar para a votação</a>
      <h2 className="titulo">Apuração</h2>
      <form onSubmit={carregar}>
        <label className="campo" htmlFor="tk">Token de administração</label>
        <input id="tk" type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
        {erro && <p className="msg erro" role="alert">{erro}</p>}
        <div className="acoes"><button className="primario">Apurar</button></div>
      </form>

      {res && (
        <section className="resultado">
          <p className="totais">
            <strong>{res.totalVotos}</strong> votos · <strong>{res.totalVotantes}</strong> eleitores
          </p>
          {atualizado && (
            <p className="atualizado">
              Atualizado às {atualizado.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          )}
          <div className="busca">
            <input
              type="search" value={filtro} autoComplete="off"
              placeholder="Filtrar por nome" aria-label="Filtrar candidatos por nome"
              onChange={(e) => setFiltro(e.target.value)}
            />
            {filtro && (
              <button type="button" className="limpar" onClick={() => setFiltro('')} aria-label="Limpar filtro">×</button>
            )}
          </div>
          {itens.length === 0 && <p className="contagem">Nenhum candidato encontrado para “{filtro}”.</p>}
          <ul>
            {itens.map((i) => (
              <li key={i.candidato}>
                <div className="linha">
                  <span>{i.candidato === BRANCO ? 'Voto em branco' : i.candidato}</span>
                  <b>{i.votos} <small>({pct(i.votos)}%)</small></b>
                </div>
                <div className="barra"><span style={{ width: `${(i.votos / maximo) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
          <button type="button" className="secundario" onClick={carregar}>Atualizar</button>
        </section>
      )}
    </>
  )
}
