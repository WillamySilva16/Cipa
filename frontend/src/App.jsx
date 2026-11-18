import { useEffect, useMemo, useRef, useState } from 'react'
import { validarCpf, registrarVoto, apuracao } from './api.js'

const BRANCO = 'VOTO EM BRANCO'
const SEGUNDOS_RESET = 6

const mascara = (v) =>
  v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')

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

function Urna() {
  return (
    <svg className="urna" viewBox="0 0 48 48" aria-hidden="true">
      <rect x="6" y="20" width="36" height="22" rx="4" fill="#F5B700" />
      <rect x="14" y="26" width="20" height="4" rx="2" fill="#0A2347" />
      <path d="M18 6h12a2 2 0 0 1 2 2v9H16V8a2 2 0 0 1 2-2z" fill="#fff" />
      <path d="M20 11l3 3 5-6" fill="none" stroke="#1558D6" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
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
          <Urna />
          <div>
            <h1>Eleição da CIPA</h1>
            <p>Seu voto é secreto.</p>
          </div>
        </div>
      </header>
      <main className="cartao">{rota === '#apuracao' ? <Apuracao /> : <Votacao />}</main>
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
    if (cpf.replace(/\D/g, '').length < 11) return setErro('Digite os 11 números do CPF.')
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
      <>
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
      </>
    )

  if (etapa === 'voto')
    return (
      <>
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

          {visiveis.map((c) => (
            <label key={c.nome} className="cand">
              <input type="radio" name="cand" checked={escolha === c.nome} onChange={() => setEscolha(c.nome)} />
              <span className="caixa" aria-hidden="true">
                <svg viewBox="0 0 20 20"><path d="M4 10.5l4 4 8-9" /></svg>
              </span>
              <span className="info">
                <b>{c.nome}</b>
                {c.funcao && <small>{c.funcao}</small>}
              </span>
            </label>
          ))}

          <label className="cand branco">
            <input type="radio" name="cand" checked={escolha === BRANCO} onChange={() => setEscolha(BRANCO)} />
            <span className="caixa" aria-hidden="true">
              <svg viewBox="0 0 20 20"><path d="M4 10.5l4 4 8-9" /></svg>
            </span>
            <span className="info"><b>Voto em branco</b></span>
          </label>
        </fieldset>

        {erro && <p className="msg erro" role="alert">{erro}</p>}

        <div className="acoes">
          <button type="button" className="primario" disabled={!escolha || carregando} onClick={() => dlg.current?.showModal()}>
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
      </>
    )

  return (
    <>
      <Passos atual={0} />
      <form onSubmit={continuar} noValidate>
        <h2 className="titulo">Informe seu CPF</h2>
        <p className="apoio">
          Usamos o CPF só para liberar o voto e garantir que cada pessoa vote uma vez. Ele não fica ligado à sua escolha.
        </p>
        <label className="campo" htmlFor="cpf">CPF</label>
        <input
          id="cpf" type="text" inputMode="numeric" autoComplete="off" autoFocus
          placeholder="000.000.000-00" value={cpf} aria-invalid={!!erro}
          onChange={(e) => { setCpf(mascara(e.target.value)); if (erro) setErro('') }}
        />
        {erro && <p className="msg erro" role="alert">{erro}</p>}
        <div className="acoes">
          <button className="primario" disabled={carregando}>{carregando ? 'Validando…' : 'Continuar'}</button>
        </div>
      </form>
    </>
  )
}

function Apuracao() {
  const [token, setToken] = useState('')
  const [res, setRes] = useState(null)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('')

  async function carregar(e) {
    e?.preventDefault()
    setErro('')
    try {
      setRes(await apuracao(token))
    } catch (err) {
      setRes(null); setErro(err.message)
    }
  }

  const maximo = res ? Math.max(1, ...res.itens.map((i) => i.votos)) : 1
  const itens = res
    ? res.itens.filter((i) => normaliza(i.candidato === BRANCO ? 'voto em branco' : i.candidato).includes(normaliza(filtro)))
    : []

  return (
    <>
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
                  <b>{i.votos}</b>
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
