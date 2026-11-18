async function chamar(url, opcoes) {
  const res = await fetch(url, opcoes)
  if (res.status === 204) return null
  const corpo = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(corpo.erro || 'Erro inesperado. Tente novamente.')
  return corpo
}

const json = (corpo) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(corpo),
})

export const validarCpf = (cpf) => chamar('/api/validar', json({ cpf }))
export const registrarVoto = (cpf, candidato) => chamar('/api/votos', json({ cpf, candidato }))
export const apuracao = (token) => chamar('/api/admin/apuracao', { headers: { 'X-Admin-Token': token } })
