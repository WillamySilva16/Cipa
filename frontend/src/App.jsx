import { useEffect, useMemo, useState } from 'react'
import { validarCpf, registrarVoto, apuracao } from './api.js'

const BRANCO = 'VOTO EM BRANCO'

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

export default function App() {
  const [rota, setRota] = useState(window.location.hash)
  useEffect(() => {
    const f = () => setRota(window.location.hash)
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return (
    <main>
      <header>
        <h1>Eleição CIPA</h1>
        <p className="sub">Seu voto é secreto.</p>
      </header>
      {rota === '#apuracao' ? <Apuracao /> : <Votacao />}
    </main>
  )
}

function Votacao() {
  const [etapa, setEtapa] = useState('cpf') // cpf | voto | fim
  const [cpf, setCpf] = useState('')
  const [dados, setDados] = useState(null)
  const [escolha, setEscolha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const candidatos = useMemo(
    () => (dados ? [...embaralha(dados.candidatos), { nome: BRANCO, funcao: '' }] : []),
    [dados]
  )

  // volta para a tela inicial depois do voto, para o próximo eleitor
  useEffect(() => {
    if (etapa !== 'fim') return
    const t = setTimeout(() => window.location.reload(), 6000)
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
    if (!escolha) return
    if (!window.confirm(`Confirmar voto em: ${escolha}?\nNão será possível alterar.`)) return
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
    setCpf(''); setDados(null); setEscolha(''); setErro(''); setEtapa('cpf')
  }

  if (etapa === 'fim')
    return (
      <section className="card fim">
        <div className="ico">✓</div>
        <h2>Voto registrado!</h2>
        <p className="sub">Obrigado por participar da eleição da CIPA.</p>
      </section>
    )

  if (etapa === 'voto')
    return (
      <section className="card">
        <div className="quem">
          Votando como
          <b>{dados.nome}</b>
          <span>{dados.cargo}</span>
        </div>
        {candidatos.map((c) => (
          <label key={c.nome} className={'cand' + (escolha === c.nome ? ' sel' : '')}>
            <input type="radio" name="cand" checked={escolha === c.nome} onChange={() => setEscolha(c.nome)} />
            <span>
              {c.nome}
              {c.funcao && <small>{c.funcao}</small>}
            </span>
          </label>
        ))}
        <button disabled={!escolha || carregando} onClick={confirmar}>
          {carregando ? 'Registrando…' : 'Confirmar voto'}
        </button>
        <button className="sec" disabled={carregando} onClick={voltar}>Voltar</button>
        {erro && <p className="msg err">{erro}</p>}
      </section>
    )

  return (
    <form className="card" onSubmit={continuar}>
      <label className="f" htmlFor="cpf">CPF</label>
      <input
        id="cpf" type="text" inputMode="numeric" autoComplete="off" autoFocus
        placeholder="000.000.000-00" value={cpf}
        onChange={(e) => setCpf(mascara(e.target.value))}
      />
      <button disabled={carregando}>{carregando ? 'Validando…' : 'Continuar'}</button>
      {erro && <p className="msg err">{erro}</p>}
    </form>
  )
}

function Apuracao() {
  const [token, setToken] = useState('')
  const [res, setRes] = useState(null)
  const [erro, setErro] = useState('')

  async function carregar(e) {
    e?.preventDefault()
    setErro('')
    try {
      setRes(await apuracao(token))
    } catch (err) {
      setRes(null); setErro(err.message)
    }
  }

  return (
    <section className="card">
      <form onSubmit={carregar}>
        <label className="f" htmlFor="tk">Token de administração</label>
        <input id="tk" type="password" value={token} onChange={(e) => setToken(e.target.value)} />
        <button>Apurar</button>
      </form>
      {erro && <p className="msg err">{erro}</p>}
      {res && (
        <>
          <p className="sub" style={{ marginTop: 16 }}>
            {res.totalVotos} votos registrados · {res.totalVotantes} eleitores
          </p>
          <table>
            <thead><tr><th>Candidato</th><th>Votos</th></tr></thead>
            <tbody>
              {res.itens.map((i) => (
                <tr key={i.candidato}><td>{i.candidato}</td><td>{i.votos}</td></tr>
              ))}
            </tbody>
          </table>
          <button className="sec" onClick={carregar}>Atualizar</button>
        </>
      )}
    </section>
  )
}
